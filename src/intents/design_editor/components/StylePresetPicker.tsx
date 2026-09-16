import React from "react";
import type { WarpEffect } from "../hooks/useSvgTextWarp";
import { Carousel, ImageCard, Box, Rows, Text } from "@canva/app-ui-kit";

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
  const handlePresetClick = (e: React.MouseEvent, effect: WarpEffect) => {
    e.stopPropagation();
    e.preventDefault();
    if (typeof onSelectEffect === "function") {
      try {
        onSelectEffect(effect);
      } catch (err) {
        console.error("Error executing onSelectEffect:", err);
      }
    }
  };

  console.log("Preset ", PRESETS);

  return (
    <Rows spacing="1u">
      <Text size="small" variant="bold">
        Warp type
      </Text>

      <Carousel>
        {PRESETS.map((preset) => {
          const isSelected = selectedEffect === preset.effect;

          if (preset.id === "custom") {
            return (
              <div
               
                style={{
                  cursor: "pointer",
                  width: "100%",
                  height: "100%",
                  display: "block",
                  outline: "none",
                  background: "#f5f5f5",
                  padding: "0px 10px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                tabIndex={0}
                onClick={(e) => handlePresetClick(e, preset.effect)}
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
            );
          }

          return (
            <ImageCard
              key={preset.id}
              ariaLabel={preset.name}
              alt={preset.name}
              thumbnailUrl={preset.image ?? ""}
              thumbnailHeight={60}
              selectable
              selected={isSelected}
              borderRadius="none"
              onClick={() => {
                if (typeof onSelectEffect === "function") {
                  onSelectEffect(preset.effect);
                }
              }}
            />
          );
        })}
      </Carousel>
    </Rows>
  );
}

export default StylePresetPicker;