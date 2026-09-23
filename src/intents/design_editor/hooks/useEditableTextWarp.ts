import { useCallback, useEffect, useState } from "react";
import { upload } from "@canva/asset";
import { buildExportSvgMarkup, WarpRenderArgs } from "../../../utils/buildWarpedImage";
import { svgToPngDataUrl } from "../../../utils/svgToPngExport";
import {
  textWarpAppElementClient,
  TextWarpAppElementData,
  TextWarpAppElementChangeEvent,
} from "../appElement";

interface EditableWarpArgs extends WarpRenderArgs {
  fontFamily: string; // stable dropdown value, stored so it can be restored later
}

export function useEditableTextWarp() {
  const [selected, setSelected] = useState<TextWarpAppElementChangeEvent | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Fires only for elements THIS app created as an app element — a plain
  // "Image" mode element never triggers this, so switching modes never
  // conflicts with restoring state.
  useEffect(() => {
    textWarpAppElementClient.registerOnElementChange((appElement) => {
      setSelected(appElement ? { data: appElement.data, update: appElement.update } : null);
    });
  }, []);

  const addOrUpdate = useCallback(
    async (args: EditableWarpArgs) => {
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
        };

        // addOrUpdateElement handles both cases itself: if an app element
        // (of this type) is currently selected, it overwrites that element;
        // otherwise it creates a new one.
        await textWarpAppElementClient.addOrUpdateElement(elementData);
      } catch (error) {
        console.error("Editable add/update failed:", error);
      } finally {
        setIsAdding(false);
      }
    },
    [],
  );

  return {
    addOrUpdate,
    isAdding,
    selectedData: selected?.data ?? null,
    isEditingExisting: Boolean(selected),
  };
}