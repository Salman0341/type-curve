import { initAppElement } from "@canva/design";
import type { AppElementOptions, ImageRef } from "@canva/design";
import type { CustomMeshState } from "../../utils/customWarpMath";
import type { WarpEffect } from "./hooks/useSvgTextWarp";
import type { WarpStyle, OutlineVariant } from "../../utils/strokeStyle";
import type { ShadowConfig, DecorationConfig, StrokeConfig } from "../../utils/buildWarpedImage";
import type { FillColor } from "../../utils/fillColor";

export interface TextWarpAppElementData {
  text: string;
  color: FillColor | string;
  effect: WarpEffect;
  fontFamily: string;
  thickness: number;
  style: WarpStyle;
  variant: OutlineVariant;
  customMesh: CustomMeshState;
  lineHeight: number;
  imageRef: ImageRef;
  width: number;
  height: number;
  shadow?: ShadowConfig;
  decoration?: string;
  decorationConfig?: DecorationConfig;
  strokeConfig?: StrokeConfig; // Naya prop
}

export type TextWarpAppElementChangeEvent = {
  data: TextWarpAppElementData;
  update?: (opts: AppElementOptions<TextWarpAppElementData>) => Promise<void>;
};

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