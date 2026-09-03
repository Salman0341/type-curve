import { useCallback, useState } from "react";
import { upload } from "@canva/asset";
import { addElementAtPoint, getCurrentPageContext } from "@canva/design";
import { loadFont, textToSvgPathData } from "../../../utils/textToSvgPath";
import { warpPathData } from "../../../utils/svgWarpEngine";
import type { TextBounds } from "../../../utils/warpTransformers";
import {
  createBulgeTransformer,
  createRiseDecreaseTransformer,
  createRiseIncreaseTransformer,
  createCustomMeshTransformer,
  DEFAULT_CUSTOM_MESH,
} from "../../../utils/warpTransformers";
import type { CustomMeshState } from "../../../utils/customWarpMath";
import { svgToPngDataUrl } from "../../../utils/svgToPngExport";
import type { WarpStyle, OutlineVariant } from "../../../utils/strokeStyle";
import { computeRenderStyle } from "../../../utils/strokeStyle";
import type { WarpEffect } from "./useSvgTextWarp";
import fontUrl from "../../../assets/fonts/ArialBlack.ttf";

interface WarpRenderArgs {
  text: string;
  color: string;
  thickness: number;
  style: WarpStyle;
  variant: OutlineVariant;
  effect?: WarpEffect;
  customMesh?: CustomMeshState;
}

async function buildExportSvgMarkup(
  args: WarpRenderArgs,
): Promise<{ svgMarkup: string; width: number; height: number }> {
  const font = await loadFont(fontUrl);
  const baseFontSize = 100;

  const measurePath = font.getPath(args.text, 0, 0, baseFontSize);
  const box = measurePath.getBoundingBox();
  const textHeight = Math.max(box.y2 - box.y1, 1);

  const startX = -box.x1;
  const startY = -box.y1 + textHeight;

  let d = textToSvgPathData(font, args.text, startX, startY, baseFontSize);

  const finalPath = font.getPath(args.text, startX, startY, baseFontSize);
  const finalBox = finalPath.getBoundingBox();
  const bounds: TextBounds = {
    minX: finalBox.x1,
    maxX: finalBox.x2,
    minY: finalBox.y1,
    maxY: finalBox.y2,
  };

  const effect = args.effect || "bulge";
  if (effect !== "none") {
    let transformer;
    if (effect === "rise-decrease") {
      transformer = createRiseDecreaseTransformer(bounds);
    } else if (effect === "rise-increase") {
      transformer = createRiseIncreaseTransformer(bounds);
    } else if (effect === "custom") {
      transformer = createCustomMeshTransformer(
        bounds,
        args.customMesh || DEFAULT_CUSTOM_MESH,
      );
    } else {
      transformer = createBulgeTransformer(bounds);
    }

    d = warpPathData({ pathData: d, transformer });
  }

  const renderStyle = computeRenderStyle(
    args.style,
    args.variant,
    args.thickness,
  );
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

  const paddingX = Math.max((bounds.maxX - bounds.minX) * 0.1, 12);
  const paddingY = Math.max((bounds.maxY - bounds.minY) * 0.2, 12);

  const vbX = bounds.minX - paddingX;
  const vbY = bounds.minY - paddingY;
  const vbW = Math.max(bounds.maxX - bounds.minX + paddingX * 2, 10);
  const vbH = Math.max(bounds.maxY - bounds.minY + paddingY * 2, 10);

  const exportW = Math.max(Math.round(vbW * 3), 100);
  const exportH = Math.max(Math.round(vbH * 3), 100);

  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${exportW}" height="${exportH}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">${strokeElements}${fillElement}</svg>`;

  return { svgMarkup, width: exportW, height: exportH };
}

export function useAddTextWarpToDesign(args: WarpRenderArgs) {
  const [isAdding, setIsAdding] = useState(false);

  const addToDesign = useCallback(async () => {
    if (!args.text.trim()) return;

    setIsAdding(true);
    try {
      const { svgMarkup, width, height } = await buildExportSvgMarkup(args);
      const dataUrl = await svgToPngDataUrl(svgMarkup, width, height);

      const { ref } = await upload({
        type: "image",
        mimeType: "image/png",
        url: dataUrl,
        thumbnailUrl: dataUrl,
        width,
        height,
        aiDisclosure: "none",
      });

      const pageContext = await getCurrentPageContext();
      const pageWidth = pageContext.dimensions?.width ?? 500;
      const pageHeight = pageContext.dimensions?.height ?? 500;

      const elementWidth = Math.min(width / 2, pageWidth * 0.7);
      const elementHeight = (elementWidth * height) / width;

      await addElementAtPoint({
        type: "image",
        ref,
        altText: undefined,
        top: (pageHeight - elementHeight) / 2,
        left: (pageWidth - elementWidth) / 2,
        width: elementWidth,
        height: elementHeight,
      });
    } catch (error) {
      console.error("Add to design failed:", error);
    } finally {
      setIsAdding(false);
    }
  }, [args]);

  return { addToDesign, isAdding };
}
