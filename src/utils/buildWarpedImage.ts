import { loadFont } from "./textToSvgPath";
import type { TextBounds } from "./warpTransformers";
import {
  createBulgeTransformer,
  createRiseDecreaseTransformer,
  createRiseIncreaseTransformer,
} from "./warpTransformers";
import type { WarpStyle, OutlineVariant } from "./strokeStyle";
import { computeRenderStyle } from "./strokeStyle";
import type { WarpEffect } from "../intents/design_editor/hooks/useSvgTextWarp";
import {
  CustomMeshState,
  DEFAULT_CUSTOM_MESH,
  createCustomMeshTransformer,
} from "./customWarpMath";

export interface WarpRenderArgs {
  text: string;
  color: string;
  thickness: number;
  style: WarpStyle;
  variant: OutlineVariant;
  effect?: WarpEffect;
  customMesh?: CustomMeshState;
  fontUrl: string;
}

export async function buildExportSvgMarkup(
  args: WarpRenderArgs,
): Promise<{ svgMarkup: string; width: number; height: number }> {
  const font = await loadFont(args.fontUrl);
  const baseFontSize = 100;

  const path = font.getPath(args.text, 0, 0, baseFontSize);
  const naturalBB = path.getBoundingBox();
  const naturalWidth = Math.max(naturalBB.x2 - naturalBB.x1, 1);
  const naturalHeight = Math.max(naturalBB.y2 - naturalBB.y1, 1);

  const effect = args.effect || "bulge";

  if (effect !== "none") {
    let transformPoint: (x: number, y: number) => { x: number; y: number };

    if (effect === "custom") {
      const meshTransform = createCustomMeshTransformer(args.customMesh ?? DEFAULT_CUSTOM_MESH);
      transformPoint = (x: number, y: number) => {
        const res = meshTransform(x - naturalBB.x1, y - naturalBB.y1, naturalWidth, naturalHeight);
        return { x: naturalBB.x1 + res.x, y: naturalBB.y1 + res.y };
      };
    } else {
      const bounds: TextBounds = {
        minX: naturalBB.x1,
        maxX: naturalBB.x2,
        minY: naturalBB.y1,
        maxY: naturalBB.y2,
      };
      const sideTransform =
        effect === "rise-decrease"
          ? createRiseDecreaseTransformer(bounds)
          : effect === "rise-increase"
          ? createRiseIncreaseTransformer(bounds)
          : createBulgeTransformer(bounds);
      transformPoint = (x: number, y: number) => sideTransform(x, y);
    }

    path.commands = path.commands.map((cmd: any) => {
      const c = { ...cmd };
      if (typeof c.x === "number" && typeof c.y === "number") {
        const p = transformPoint(c.x, c.y);
        c.x = p.x;
        c.y = p.y;
      }
      if (typeof c.x1 === "number" && typeof c.y1 === "number") {
        const p1 = transformPoint(c.x1, c.y1);
        c.x1 = p1.x;
        c.y1 = p1.y;
      }
      if (typeof c.x2 === "number" && typeof c.y2 === "number") {
        const p2 = transformPoint(c.x2, c.y2);
        c.x2 = p2.x;
        c.y2 = p2.y;
      }
      return c;
    });
  }

  const d = path.toPathData(3);

  const warpedBB = path.getBoundingBox();
  const width = Math.max(warpedBB.x2 - warpedBB.x1, 1);
  const height = Math.max(warpedBB.y2 - warpedBB.y1, 1);

  const renderStyle = computeRenderStyle(args.style, args.variant, args.thickness);
  const fillColor = args.color || "#000000";

  const strokeElements = !renderStyle.isSolid
    ? renderStyle.layers
        .map(
          (layer) =>
            `<path d="${d}" fill="none" stroke="${fillColor}" stroke-opacity="${layer.strokeOpacity}" stroke-width="${layer.strokeWidth}" stroke-linejoin="${renderStyle.strokeLinejoin}" stroke-dasharray="${renderStyle.strokeDasharray}" />`,
        )
        .join("")
    : "";

  const fillElement = `<path d="${d}" fill="${fillColor}" />`;

  const padding = Math.max(width, height) * 0.06 + 6;
  const vbX = warpedBB.x1 - padding;
  const vbY = warpedBB.y1 - padding;
  const vbW = width + padding * 2;
  const vbH = height + padding * 2;

  const exportW = Math.round(vbW * 3);
  const exportH = Math.round(vbH * 3);

  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${exportW}" height="${exportH}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">${strokeElements}${fillElement}</svg>`;

  return { svgMarkup, width: exportW, height: exportH };
}