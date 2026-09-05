import React from "react";
import type { WarpEffect } from "../hooks/useSvgTextWarp";

import d1Image from "../../../assets/presets/d1.png";
import d2Image from "../../../assets/presets/d2.png";
import d3Image from "../../../assets/presets/d3.png";

export interface PresetOption {
  id: string;
  name: string;
  effect: WarpEffect;
  image?: string;
  isCustom?: boolean;
}

export const PRESETS: PresetOption[] = [
  {
    id: "bulge",
    name: "Bulge Circle",
    effect: "bulge",
    image: d1Image,
  },
  {
    id: "rise-decrease",
    name: "Perspective Shrink",
    effect: "rise-decrease",
    image: d2Image,
  },
  {
    id: "rise-increase",
    name: "Perspective Grow",
    effect: "rise-increase",
    image: d3Image,
  },
  {
    id: "custom",
    name: "Custom Mesh",
    effect: "custom",
    isCustom: true,
  },
];

export { PRESETS as STYLE_PRESETS };

interface StylePresetPickerProps {
  selectedEffect?: WarpEffect;
  onSelectEffect?: (effect: WarpEffect) => void;
}

export function StylePresetPicker({
  selectedEffect,
  onSelectEffect,
}: StylePresetPickerProps) {
  const handlePresetClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    effect: WarpEffect,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (typeof onSelectEffect === "function") {
      try {
        onSelectEffect(effect);
      } catch (err) {
        console.error("Error executing onSelectEffect:", err);
      }
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <label style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>
        Warp type
      </label>

      <div
        style={{
          display: "flex",
          gap: 12,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          overflowX: "auto",
          paddingBottom: 8,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {PRESETS.map((preset) => {
          const isSelected = selectedEffect === preset.effect;

          return (
            <button
              key={preset.id}
              onClick={(e) => handlePresetClick(e, preset.effect)}
              type="button"
              style={{
                flex: "0 0 auto",
                width: 84,
                height: 84,
                boxSizing: "border-box",
                borderRadius: 10,
                border: isSelected
                  ? "2.5px solid #7d2ae8"
                  : "1px solid #e0e0e0",
                background: "#f9f9f9",
                padding: 4,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                scrollSnapAlign: "start",
                transition: "all 0.2s ease-in-out",
                boxShadow: isSelected
                  ? "0 2px 8px rgba(125, 42, 232, 0.25)"
                  : "none",
                outline: "none",
              }}
            >
              {preset.isCustom ? (
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
                  <span style={{ fontSize: 10, fontWeight: 600 }}>Custom</span>
                </div>
              ) : (
                <img
                  src={preset.image}
                  alt={preset.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    borderRadius: 6,
                    pointerEvents: "none",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default StylePresetPicker;
