// src/utils/buildWarpedImage.ts
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
import type { CustomMeshState } from "./customWarpMath";
import {
  DEFAULT_CUSTOM_MESH,
  createCustomMeshTransformer,
} from "./customWarpMath";
import type { FillColor } from "./fillColor";
import { toRepresentativeHex, toSvgFill } from "./fillColor";
import { flattenCurves } from "./pathSubdivide";
import { getMultilinePath } from "./multilineTextPath";

export interface ShadowConfig {
  type: string;
  offset: number;
  angle: number;
  blur: number;
  color: FillColor | string;
}

export interface WarpRenderArgs {
  text: string;
  color: FillColor;
  thickness: number;
  style: WarpStyle;
  variant: OutlineVariant;
  effect?: WarpEffect;
  customMesh?: CustomMeshState;
  fontUrl: string;
  lineHeight?: number;
  shadow?: ShadowConfig;
  decoration?: string;
}

export async function buildExportSvgMarkup(
  args: WarpRenderArgs,
): Promise<{ svgMarkup: string; width: number; height: number }> {
  const font = await loadFont(args.fontUrl);
  const baseFontSize = 100;

  const path = getMultilinePath(font, args.text, baseFontSize, args.lineHeight ?? 1.15);

  path.commands = flattenCurves(path.commands as any) as any;

  const naturalBB = path.getBoundingBox();
  const naturalWidth = Math.max(naturalBB.x2 - naturalBB.x1, 1);
  const naturalHeight = Math.max(naturalBB.y2 - naturalBB.y1, 1);

  const effect = args.effect || "bulge";

  if (effect !== "none") {
    let transformPoint: (x: number, y: number) => { x: number; y: number };

    if (effect === "custom") {
      const meshTransform = createCustomMeshTransformer(
        args.customMesh ?? DEFAULT_CUSTOM_MESH,
      );
      transformPoint = (x: number, y: number) => {
        const res = meshTransform(
          x - naturalBB.x1,
          y - naturalBB.y1,
          naturalWidth,
          naturalHeight,
        );
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

  const d = path.toPathData(4);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  path.commands.forEach((cmd: any) => {
    const processPoint = (x?: number, y?: number) => {
      if (typeof x === "number" && !isNaN(x)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      if (typeof y === "number" && !isNaN(y)) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    };
    processPoint(cmd.x, cmd.y);
    processPoint(cmd.x1, cmd.y1);
    processPoint(cmd.x2, cmd.y2);
  });

  if (!isFinite(minX)) minX = naturalBB.x1;
  if (!isFinite(maxX)) maxX = naturalBB.x2;
  if (!isFinite(minY)) minY = naturalBB.y1;
  if (!isFinite(maxY)) maxY = naturalBB.y2;

  const actualWidth = Math.max(maxX - minX, 1);
  const actualHeight = Math.max(maxY - minY, 1);

  const renderStyle = computeRenderStyle(
    args.style,
    args.variant,
    args.thickness,
  );

  const strokeColor = toRepresentativeHex(args.color);
  const gradientId = `warp-export-gradient-${Math.random().toString(36).substring(2, 9)}`;
  const { fillAttr, defsMarkup } = toSvgFill(args.color, gradientId);

  // --- SHADOW FILTER CREATION ---
  let shadowFilterMarkup = "";
  let filterAttribute = "";

  if (args.shadow && args.shadow.type !== "none") {
    const filterId = `export-shadow-filter-${Math.random().toString(36).substring(2, 9)}`;
    const rad = (args.shadow.angle * Math.PI) / 180;
    const dx = args.shadow.offset * Math.cos(rad);
    const dy = args.shadow.offset * Math.sin(rad);
    const shadowHex = typeof args.shadow.color === "string" 
      ? args.shadow.color 
      : toRepresentativeHex(args.shadow.color);

    shadowFilterMarkup = `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${args.shadow.blur / 2}" flood-color="${shadowHex}" flood-opacity="0.8"/>
    </filter>`;
    filterAttribute = ` filter="url(#${filterId})"`;
  }

  const strokeElements =
    !renderStyle.isSolid && args.thickness > 0
      ? renderStyle.layers
          .map(
            (layer) =>
              `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-opacity="${layer.strokeOpacity}" stroke-width="${layer.strokeWidth}" stroke-linejoin="${renderStyle.strokeLinejoin}" stroke-dasharray="${renderStyle.strokeDasharray}" />`,
          )
          .join("")
      : "";

  const fillElement = `<path d="${d}" fill="${fillAttr}"${filterAttribute} />`;

  const combinedDefs = [defsMarkup, shadowFilterMarkup].filter(Boolean).join("");
  const defsSection = combinedDefs ? `<defs>${combinedDefs}</defs>` : "";

  // Extra padding calculation including shadow offset and blur
  const shadowPadding = args.shadow && args.shadow.type !== "none" ? args.shadow.offset + args.shadow.blur : 0;
  const strokePadding = args.thickness > 0 ? args.thickness * 2 : 0;
  const horizontalClearance = Math.max(actualWidth * 0.08, 16) + strokePadding + shadowPadding;
  const verticalClearance = Math.max(actualHeight * 0.08, 16) + strokePadding + shadowPadding;

  const vbX = minX - horizontalClearance;
  const vbY = minY - verticalClearance;
  const vbW = actualWidth + horizontalClearance * 2;
  const vbH = actualHeight + verticalClearance * 2;

  const exportW = Math.round(vbW * 3);
  const exportH = Math.round(vbH * 3);

  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${exportW}" height="${exportH}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">${defsSection}<g>${fillElement}${strokeElements}</g></svg>`;

  return { svgMarkup, width: exportW, height: exportH };
}