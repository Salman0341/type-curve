import { useCallback, useState } from "react";
import { upload } from "@canva/asset";
import { addElementAtPoint, getCurrentPageContext } from "@canva/design";
import type { WarpRenderArgs } from "../../../utils/buildWarpedImage";
import { buildExportSvgMarkup } from "../../../utils/buildWarpedImage";
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
      const pageWidth = pageContext.dimensions?.width ?? 800;
      const pageHeight = pageContext.dimensions?.height ?? 600;

      // Element width canvas ka 70% aur aspect ratio perfectly preserved
      const elementWidth = Math.round(Math.min(width, pageWidth * 0.7));
      const elementHeight = Math.round((elementWidth * height) / width);

      const top = Math.round((pageHeight - elementHeight) / 2);
      const left = Math.round((pageWidth - elementWidth) / 2);

      await addElementAtPoint({
        type: "image",
        ref,
        altText: {
          text: args.text,
          decorative: false,
        },
        top,
        left,
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
