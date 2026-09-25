// src/intents/design_editor/components/GradientColorField.tsx
import React, { useState } from "react";
import { Text, Swatch } from "@canva/app-ui-kit";
import { ArrowLeftIcon } from "@canva/app-ui-kit/icons";
import type { Anchor, ColorSelectionEvent } from "@canva/asset";
import { openColorSelector } from "@canva/asset";
import type { FillColor, GradientColor } from "../../../utils/fillColor";
import { isGradient, toCssBackground } from "../../../utils/fillColor";

interface GradientColorFieldProps {
  value: FillColor;
  onChange: (next: FillColor) => void;
}

const g = (stops: [string, string], angle = 135): GradientColor => ({
  type: "gradient",
  shape: "linear",
  angle,
  stops: [
    { hexString: stops[0], offset: 0 },
    { hexString: stops[1], offset: 1 },
  ],
});

const COOL_TONES: GradientColor[] = [
  g(["#5aa9c9", "#2a7ab8"]),
  g(["#2a3f9a", "#1a2a6a"]),
  g(["#3aa88a", "#1a7a6a"]),
  g(["#9ad8d8", "#5ab0c9"]),
  g(["#b8dcf0", "#8ac0e8"]),
  g(["#7ac0f0", "#4a9ae8"]),
  g(["#4a9ae8", "#2a7ad8"]),
];

const WARM_TONES: GradientColor[] = [
  g(["#ff8a6a", "#f05a5a"]),
  g(["#8a2a5a", "#5a1a4a"]),
  g(["#a86a4a", "#8a4a2a"]),
  g(["#ffa04a", "#f0703a"]),
  g(["#c98a5a", "#a86a4a"]),
  g(["#ff9ab8", "#e85a8a"]),
  g(["#ffb0a0", "#ff7a9a"]),
];

const MONOCHROMATIC: GradientColor[] = [
  g(["#3a3a3a", "#1a1a1a"]),
  g(["#a8a8a8", "#7a7a7a"]),
  g(["#f0ece0", "#d8d0c0"]),
  g(["#d8d8d8", "#b0b0b0"]),
  g(["#a8b0c0", "#8090a8"]),
  g(["#5a6a7a", "#3a4a5a"]),
  g(["#2a2a3a", "#1a1a2a"]),
  g(["#c92a2a", "#8a1a1a"]),
  g(["#e07a2a", "#b0551a"]),
  g(["#e0c02a", "#b09a1a"]),
  g(["#3aa848", "#2a7a38"]),
  g(["#2aa89a", "#1a7a70"]),
  g(["#2a5ac9", "#1a3a8a"]),
  g(["#7a2ac9", "#5a1a8a"]),
  g(["#ff9a9a", "#f06a6a"]),
  g(["#ffb08a", "#f08a5a"]),
  g(["#fff0a0", "#ffe070"]),
  g(["#a0e0a0", "#70c070"]),
  g(["#a0f0e8", "#70d8c8"]),
  g(["#b0c8f0", "#8aa8e0"]),
  g(["#f0c0f0", "#e0a0e0"]),
];

const ALL_GRADIENTS: GradientColor[] = [
  g(["#d8d8d8", "#a8a8a8"]),
  g(["#8a8a8a", "#4a4a4a"]),
  g(["#3a3a3a", "#1a1a1a"]),
  g(["#2a3a9a", "#1a1a4a"]),
  g(["#3a2a1a", "#8a6a2a"]),
  g(["#7a5ac9", "#e88aa0"]),
  g(["#f0a0c0", "#f0d0d8"]),
  g(["#ff8a8a", "#f05a7a"]),
  g(["#ffb050", "#f08a2a"]),
  g(["#9ae0d0", "#5ac0b0"]),
  g(["#a0c0f0", "#7098e0"]),
  g(["#f0b0e0", "#e090d0"]),
];

const GRADIENT_CATEGORIES: Array<{ label: string; gradients: GradientColor[] }> = [
  { label: "Cool tones", gradients: COOL_TONES },
  { label: "Warm tones", gradients: WARM_TONES },
  { label: "Monochromatic", gradients: MONOCHROMATIC },
  { label: "All gradients", gradients: ALL_GRADIENTS },
];

const COMPACT_PREVIEW: GradientColor[] = [
  ...MONOCHROMATIC.slice(0, 7),
  ...COOL_TONES.slice(0, 1),
  ...WARM_TONES.slice(0, 2),
  ...MONOCHROMATIC.slice(7, 14),
  ...COOL_TONES.slice(1, 5),
];

function anchorFromEvent(e: React.MouseEvent<HTMLElement>): Anchor {
  const rect = e.currentTarget.getBoundingClientRect();
  return { width: rect.width, height: rect.height, top: rect.top, left: rect.left };
}

function pickSolidColor(anchor: Anchor, current: string): Promise<string | null> {
  return new Promise((resolve) => {
    openColorSelector(anchor, {
      scopes: ["solid"],
      selectedColor: { type: "solid", hexString: current },
      onColorSelect: (event: ColorSelectionEvent<"solid">) => {
        resolve(event.selection.type === "solid" ? event.selection.hexString : null);
      },
    });
  });
}

function isSameGradient(a: GradientColor | undefined, b: GradientColor) {
  return (
    !!a &&
    a.stops[0]?.hexString === b.stops[0].hexString &&
    a.stops[1]?.hexString === b.stops[1].hexString
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <span
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        background: checked ? "#7d2ae8" : "#d0d0d0",
        position: "relative",
        display: "inline-block",
        cursor: "pointer",
        transition: "background 0.15s ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
          transition: "left 0.15s ease",
        }}
      />
    </span>
  );
}

// A single gradient circle. Hover ring is a neutral white-gap + dark-halo
// (matching Canva's own swatch hover, not an accent color), with a
// smooth opacity/scale transition instead of an abrupt show/hide — the
// tooltip node always stays mounted so the fade is smooth, and it drops
// BELOW the swatch, matching the reference.
function GradientSwatch({
  preset,
  isSelected,
  onSelect,
}: {
  preset: GradientColor;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hexList = preset.stops.map((s) => s.hexString).join(", ");
  const tooltipLabel =
    preset.shape === "radial"
      ? `Radial gradient: ${hexList}`
      : `Linear gradient ${preset.angle}°: ${hexList}`;

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onSelect}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: toCssBackground(preset),
          border: "none",
          outline: "none",
          appearance: "none",
          WebkitAppearance: "none",
          boxShadow: isSelected
            ? "0 0 0 2px #ffffff, 0 0 0 4px #7d2ae8"
            : hovered
              ? "0 0 0 2px #ffffff, 0 0 0 4px rgba(0,0,0,0.55)"
              : "none",
          transform: hovered && !isSelected ? "scale(0.88)" : "scale(1)",
          cursor: "pointer",
          padding: 0,
          transition: "box-shadow 0.15s ease, transform 0.15s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: "50%",
          transform: hovered ? "translate(-50%, 0)" : "translate(-50%, -4px)",
          background: "#1a1a1a",
          color: "#ffffff",
          fontSize: 11,
          lineHeight: 1.4,
          padding: "4px 8px",
          borderRadius: 6,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          zIndex: 10,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.15s ease, transform 0.15s ease",
        }}
      >
        {tooltipLabel}
      </div>
    </div>
  );
}

function GradientGrid({
  gradients,
  selected,
  onSelect,
}: {
  gradients: GradientColor[];
  selected: GradientColor | undefined;
  onSelect: (g: GradientColor) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, paddingBottom: 4 }}>
      {gradients.map((preset, i) => (
        <GradientSwatch
          key={i}
          preset={preset}
          isSelected={isSameGradient(selected, preset)}
          onSelect={() => onSelect(preset)}
        />
      ))}
    </div>
  );
}

export function GradientColorField({ value, onChange }: GradientColorFieldProps) {
  const gradientOn = isGradient(value);
  const [showAll, setShowAll] = useState(false);
  const selected = isGradient(value) ? value : undefined;

  const handleToggle = (checked: boolean) => {
    if (checked && !isGradient(value)) {
      onChange(COMPACT_PREVIEW[0]);
    } else if (!checked && isGradient(value)) {
      onChange({ type: "solid", hexString: value.stops[0]?.hexString ?? "#000000" });
      setShowAll(false);
    }
  };

  const handlePick = (preset: GradientColor) => {
    onChange(preset);
    setShowAll(false);
  };

  if (gradientOn && showAll) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowAll(false)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
            aria-label="Back"
          >
            <ArrowLeftIcon />
          </button>
          <Text size="medium" variant="bold">
            Default gradient colours
          </Text>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {GRADIENT_CATEGORIES.map((cat) => (
            <div key={cat.label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Text size="small" variant="bold">
                {cat.label}
              </Text>
              <GradientGrid gradients={cat.gradients} selected={selected} onSelect={handlePick} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Text size="small" variant="bold">
          Use Gradient
        </Text>
        <ToggleSwitch checked={gradientOn} onChange={handleToggle} />
      </div>

      {!gradientOn ? (
        <Swatch
          fill={[value.type === "solid" ? value.hexString : "#000000"]}
          onClick={async (e) => {
            const picked = await pickSolidColor(anchorFromEvent(e), value.type === "solid" ? value.hexString : "#000000");
            if (picked) onChange({ type: "solid", hexString: picked });
          }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Text size="small" variant="bold">
              Default gradient colours
            </Text>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                background: "none",
                border: "none",
                color: "#7d2ae8",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              See all
            </button>
          </div>

          <GradientGrid gradients={COMPACT_PREVIEW} selected={selected} onSelect={handlePick} />
        </div>
      )}
    </div>
  );
}

export default GradientColorField;