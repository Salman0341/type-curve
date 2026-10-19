import { useCallback, useEffect, useState } from "react";
import { upload } from "@canva/asset";
import type { WarpRenderArgs } from "../../../utils/buildWarpedImage";
import { buildExportSvgMarkup } from "../../../utils/buildWarpedImage";
import { svgToPngDataUrl } from "../../../utils/svgToPngExport";
import type {
  TextWarpAppElementData,
  TextWarpAppElementChangeEvent,
} from "../appElement";
import { textWarpAppElementClient } from "../appElement";

interface EditableWarpArgs extends WarpRenderArgs {
  fontFamily: string;
}

export function useEditableTextWarp() {
  const [selected, setSelected] =
    useState<TextWarpAppElementChangeEvent | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    textWarpAppElementClient.registerOnElementChange((appElement) => {
      setSelected(
        appElement
          ? { data: appElement.data, update: appElement.update }
          : null,
      );
    });
  }, []);

  const addOrUpdate = useCallback(async (args: EditableWarpArgs) => {
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

      const elementData: TextWarpAppElementData = {
        text: args.text,
        color: args.color,
        effect: args.effect ?? "bulge",
        fontFamily: args.fontFamily,
        thickness: args.thickness,
        style: args.style,
        variant: args.variant,
        customMesh: args.customMesh!,
        imageRef: ref,
        width,
        height,
        lineHeight: args.lineHeight ?? 1.15,
        shadow: args.shadow,
        decoration: args.decoration,
        decorationConfig: args.decorationConfig,
        strokeConfig: args.strokeConfig, // Stroke yahan include ho gaya
      };

      await textWarpAppElementClient.addOrUpdateElement(elementData);
    } catch (error) {
      console.error("Editable add/update failed:", error);
    } finally {
      setIsAdding(false);
    }
  }, []);

  return {
    addOrUpdate,
    isAdding,
    selectedData: selected?.data ?? null,
    isEditingExisting: Boolean(selected),
  };
}