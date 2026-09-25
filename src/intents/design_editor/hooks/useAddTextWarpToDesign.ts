import { useCallback, useState } from "react";
import { upload } from "@canva/asset";
import { addElementAtPoint, getCurrentPageContext } from "@canva/design";
import type {
  WarpRenderArgs} from "../../../utils/buildWarpedImage";
import {
  buildExportSvgMarkup
} from "../../../utils/buildWarpedImage";
import { svgToPngDataUrl } from "../../../utils/svgToPngExport";

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
