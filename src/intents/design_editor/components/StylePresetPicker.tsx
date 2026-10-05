import React from "react";
import { Carousel, Text } from "@canva/app-ui-kit";
import { useLoadedFont } from "../hooks/useLoadedFont";
import type { WarpEffect } from "../../../utils/warpTextCompute";
import { computeWarpedText } from "../../../utils/warpTextCompute";
import type { CustomMeshState } from "../../../utils/customWarpMath";
import type { FillColor } from "../../../utils/fillColor";
import { DEFAULT_FILL_COLOR } from "../../../utils/fillColor";
import { SvgGradientDef, getSvgFillAttr } from "../../../utils/svgGradientDefs";

export interface PresetOption {
  id: string;
  name: string;
  effect?: WarpEffect;
  isCustom?: boolean;
}

export const PRESETS: PresetOption[] = [
  { id: "bulge", name: "Bulge Circle", effect: "bulge" },
  { id: "rise-decrease", name: "Perspective Shrink", effect: "rise-decrease" },
  { id: "rise-increase", name: "Perspective Grow", effect: "rise-increase" },
  { id: "custom", name: "Custom Mesh", effect: "custom", isCustom: true },
];

export { PRESETS as STYLE_PRESETS };

const THUMB_SIZE = 84;

interface StylePresetPickerProps {
  title?: string;
  presets?: PresetOption[];
  selectedEffect?: WarpEffect | string;
  onSelectEffect?: (effect: WarpEffect | string) => void;
  selectedId?: string;
  onSelect?: (id: string) => void;
  text?: string;
  fontUrl?: string;
  color?: FillColor;
  customMesh?: CustomMeshState;
  mode?: "warp" | "shadow" | "decoration";
}

export function StylePresetPicker({
  title = "Warp type",
  presets = PRESETS,
  selectedEffect,
  onSelectEffect,
  selectedId,
  onSelect,
  text = "",
  fontUrl = "",
  color = DEFAULT_FILL_COLOR,
  mode = "warp",
}: StylePresetPickerProps) {
  const { font } = useLoadedFont(fontUrl);

  const activeSelected = selectedId || selectedEffect;

  const handlePresetClick = (targetEffectOrId: string) => {
    if (typeof onSelectEffect === "function") {
      onSelectEffect(targetEffectOrId as WarpEffect);
    }
    if (typeof onSelect === "function") {
      onSelect(targetEffectOrId);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <Text size="small" variant="bold">
        {title}
      </Text>

      <Carousel>
        {presets.map((preset) => {
          const isSelected =
            activeSelected === preset.id || activeSelected === preset.effect;
          const gradientId = `warp-preset-gradient-${preset.id}`;

          let pathData = "";
          let viewBox = "0 0 320 180";

          if (
            mode === "warp" &&
            !preset.isCustom &&
            font &&
            text &&
            text.trim() &&
            preset.effect
          ) {
            try {
              const result = computeWarpedText(font, text, preset.effect);
              if (result) {
                pathData = result.pathData;
                viewBox = result.viewBox;
              }
            } catch (err) {
              console.error("Thumbnail warp error:", err);
            }
          }

          const targetValue = preset.effect || preset.id;

          return (
            <div
              key={preset.id}
              role="button"
              tabIndex={0}
              onClick={() => handlePresetClick(targetValue)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePresetClick(targetValue);
                }
              }}
              style={{
                flex: `0 0 ${THUMB_SIZE}px`,
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                boxSizing: "border-box",
                cursor: "pointer",
                outline: "none",
                borderRadius: 10,
                border: isSelected ? "2px solid #7d2ae8" : "1px solid #e0e0e0",
                background: isSelected ? "#f3ecfd" : "#f9f9f9",
                padding: 4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              {mode !== "warp" ? (
                <Text size="small" variant="bold">
                  {preset.name.toUpperCase()}
                </Text>
              ) : preset.isCustom ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    color: isSelected ? "#7d2ae8" : "#555",
                    pointerEvents: "none",
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 3h18v18H3z" strokeDasharray="3 3" />
                    <circle cx="3" cy="3" r="2" fill="currentColor" />
                    <circle cx="21" cy="3" r="2" fill="currentColor" />
                    <circle cx="3" cy="21" r="2" fill="currentColor" />
                    <circle cx="21" cy="21" r="2" fill="currentColor" />
                  </svg>
                  <Text size="xsmall" variant="bold">
                    Custom
                  </Text>
                </div>
              ) : (
                <svg
                  viewBox={viewBox}
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    pointerEvents: "none",
                  }}
                  aria-label={preset.name}
                >
                  <defs>
                    <SvgGradientDef color={color} id={gradientId} />
                  </defs>
                  {pathData && !pathData.includes("NaN") && (
                    <path d={pathData} fill={getSvgFillAttr(color, gradientId)} />
                  )}
                </svg>
              )}
            </div>
          );
        })}
      </Carousel>
    </div>
  );
}

export default StylePresetPicker;