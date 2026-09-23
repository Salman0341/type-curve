import { initAppElement } from "@canva/design";
import type { AppElementOptions, ImageRef } from "@canva/design";
import type { CustomMeshState } from "../../utils/customWarpMath";
import type { WarpEffect } from "./hooks/useSvgTextWarp";
import type { WarpStyle, OutlineVariant } from "../../utils/strokeStyle";

// This is the "recipe" stored ON the element itself (NOT the image data —
// app elements have a 5KB data limit, so we only keep the small settings
// plus a reference to the already-uploaded image). When the user re-selects
// this element, Canva hands this exact object back to us so the panel can
// restore itself to match.
export interface TextWarpAppElementData {
  text: string;
  color: string;
  effect: WarpEffect;
  fontFamily: string; // the dropdown VALUE (e.g. "roboto"), not the bundled URL
  thickness: number;
  style: WarpStyle;
  variant: OutlineVariant;
  customMesh: CustomMeshState;
  imageRef: ImageRef;
  width: number;
  height: number;
}

export type TextWarpAppElementChangeEvent = {
  data: TextWarpAppElementData;
  update?: (opts: AppElementOptions<TextWarpAppElementData>) => Promise<void>;
};

// initAppElement must be called once, outside any React component (per
// Canva's docs) — this module-level instance is shared by every hook/
// component that needs to create, update, or listen for this element type.
export const textWarpAppElementClient = initAppElement<TextWarpAppElementData>({
  render: (data) => {
    return [
      {
        type: "image",
        ref: data.imageRef,
        top: 0,
        left: 0,
        width: data.width,
        height: data.height,
        altText: {
          text: data.text,
          decorative: false,
        },
      },
    ];
  },
});