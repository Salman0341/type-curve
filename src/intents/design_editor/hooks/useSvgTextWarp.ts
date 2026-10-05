import { useMemo } from "react";
import { useLoadedFont } from "./useLoadedFont";
import type { WarpEffect } from "../../../utils/warpTextCompute";
import { computeWarpedText } from "../../../utils/warpTextCompute";
import type { CustomMeshState } from "../../../utils/customWarpMath";
import { DEFAULT_CUSTOM_MESH } from "../../../utils/customWarpMath";
import type { FillColor } from "../../../utils/fillColor";

export type { WarpEffect };

export interface ShadowConfig {
  type: string;
  offset: number;
  angle: number;
  blur: number;
  color: FillColor | string;
}

interface UseSvgTextWarpProps {
  text: string;
  effect: WarpEffect;
  fontUrl: string;
  customMesh?: CustomMeshState;
  lineHeight?: number;
  shadow?: ShadowConfig;
  decoration?: string;
}

export interface SvgTextBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useSvgTextWarp({
  text,
  effect,
  fontUrl,
  customMesh = DEFAULT_CUSTOM_MESH,
  lineHeight = 1.15,
  shadow,
  decoration = "none",
}: UseSvgTextWarpProps) {
  const {
    font,
    isLoading: fontLoading,
    error: fontError,
  } = useLoadedFont(fontUrl);

  const computed = useMemo(() => {
    if (!font || !text || !text.trim()) {
      return {
        data: null as ReturnType<typeof computeWarpedText>,
        error: null as string | null,
      };
    }
    try {
      return {
        data: computeWarpedText(
          font,
          text,
          effect,
          customMesh,
          lineHeight,
          shadow,
          decoration
        ),
        error: null as string | null,
      };
    } catch (err: any) {
      console.error("Warp execution error:", err);
      return {
        data: null as ReturnType<typeof computeWarpedText>,
        error: err?.message || "Failed to render path",
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    font,
    text,
    effect,
    JSON.stringify(customMesh),
    lineHeight,
    JSON.stringify(shadow),
    decoration,
  ]);

  const isLoading =
    fontLoading ||
    (!!text?.trim() && !!font && !computed.data && !computed.error);
  const error = fontError || computed.error;

  return {
    pathData: computed.data?.pathData ?? "",
    viewBox: computed.data?.viewBox ?? "0 0 320 180",
    textBounds: computed.data?.textBounds ?? null,
    decorationPathData: (computed.data as any)?.decorationPathData ?? "",
    isLoading,
    error,
  };
}