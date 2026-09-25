import { useMemo } from "react";
import { useLoadedFont } from "./useLoadedFont";
import type { WarpEffect } from "../../../utils/warpTextCompute";
import { computeWarpedText } from "../../../utils/warpTextCompute";
import type {
  CustomMeshState} from "../../../utils/customWarpMath";
import {
  DEFAULT_CUSTOM_MESH,
} from "../../../utils/customWarpMath";

export type { WarpEffect };

interface UseSvgTextWarpProps {
  text: string;
  effect: WarpEffect;
  fontUrl: string;
  customMesh?: CustomMeshState;
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
        data: computeWarpedText(font, text, effect, customMesh),
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
  }, [font, text, effect, JSON.stringify(customMesh)]);

  const isLoading =
    fontLoading ||
    (!!text?.trim() && !!font && !computed.data && !computed.error);
  const error = fontError || computed.error;

  return {
    pathData: computed.data?.pathData ?? "",
    viewBox: computed.data?.viewBox ?? "0 0 320 180",
    textBounds: computed.data?.textBounds ?? null,
    isLoading,
    error,
  };
}
