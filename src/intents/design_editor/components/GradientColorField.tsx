// src/intents/design_editor/components/GradientColorField.tsx
import React, { useState } from "react";
import { SegmentedControl, Text, Swatch } from "@canva/app-ui-kit";
import type { Anchor, ColorSelectionEvent } from "@canva/asset";
import { openColorSelector } from "@canva/asset";
import type { FillColor, GradientColor, GradientShape } from "../../../utils/fillColor";
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

// 4 direction/shape options — uses whatever colors are currently in the
// stops, only shape/angle differ.
const STYLE_OPTIONS: Array<{ shape: GradientShape; angle: number; label: string }> = [
  { shape: "linear", angle: 90, label: "Left to right" },
  { shape: "linear", angle: 135, label: "Diagonal" },
  { shape: "linear", angle: 45, label: "Diagonal (reverse)" },
  { shape: "radial", angle: 0, label: "Radial" },
];

// Preset full gradients — best-effort, high contrast. Not official Canva
// values (not published anywhere), eyeballed for visual variety.
const PRESETS: GradientColor[] = [
  g(["#ff9a6a", "#f0306a"], 90),
  g(["#4a6af0", "#1a1a8a"], 90),
  g(["#d030c9", "#6a105a"], 90),
  g(["#30e0c0", "#0a8a7a"], 90),
  g(["#3a5ff0", "#0a0a5a"], 135),
  g(["#ffb0c0", "#ff5a8a"], 90),
  g(["#ff90c0", "#e0208a"], 90),
  g(["#ffc080", "#e0701a"], 90),
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

// A single gradient stop circle. On hover (only when more than 2 stops
// exist — a gradient always needs at least 2) a small "x" badge appears
// in the top-right corner to remove that stop.
function StopCircle({
  hex,
  onClick,
  onRemove,
  canRemove,
}: {
  hex: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: hex,
          border: "none",
          outline: "none",
          boxShadow: hovered ? "0 0 0 2px #ffffff, 0 0 0 4px rgba(0,0,0,0.55)" : "none",
          transform: hovered ? "scale(0.9)" : "scale(1)",
          cursor: "pointer",
          padding: 0,
          transition: "box-shadow 0.15s ease, transform 0.15s ease",
        }}
      />
      {hovered && canRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove colour"
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#1a1a1a",
            border: "1.5px solid #ffffff",
            color: "#ffffff",
            fontSize: 10,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// Stretches to fill its grid cell (width: 100%) so a row of these spans
// the full panel width evenly, like the reference — no leftover gap on
// the right and no gap between fixed-size boxes.
function StretchSwatch({
  background,
  isSelected,
  onClick,
}: {
  background: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        height: 40,
        borderRadius: 8,
        background,
        border: "none",
        outline: "none",
        boxShadow: isSelected
          ? "0 0 0 2px #ffffff, 0 0 0 4px #7d2ae8"
          : hovered
            ? "0 0 0 2px #ffffff, 0 0 0 4px rgba(0,0,0,0.55)"
            : "none",
        transform: hovered && !isSelected ? "scale(0.96)" : "scale(1)",
        cursor: "pointer",
        padding: 0,
        display: "block",
        transition: "box-shadow 0.15s ease, transform 0.15s ease",
      }}
    />
  );
}

const FOUR_COLUMN_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
  width: "100%",
};

export function GradientColorField({ value, onChange }: GradientColorFieldProps) {
  const [tab, setTab] = useState<"solid" | "gradient">(isGradient(value) ? "gradient" : "solid");

  const gradient: GradientColor = isGradient(value)
    ? value
    : { type: "gradient", stops: [{ hexString: "#ff9a6a", offset: 0 }, { hexString: "#f0306a", offset: 1 }], shape: "linear", angle: 90 };

  const handleTabChange = (next: string) => {
    setTab(next as "solid" | "gradient");
    if (next === "gradient" && !isGradient(value)) {
      onChange(gradient);
    } else if (next === "solid" && isGradient(value)) {
      onChange({ type: "solid", hexString: value.stops[0]?.hexString ?? "#000000" });
    }
  };

  const handleStopClick = async (e: React.MouseEvent<HTMLButtonElement>, i: number) => {
    const picked = await pickSolidColor(anchorFromEvent(e), gradient.stops[i].hexString);
    if (!picked) return;
    onChange({ ...gradient, stops: gradient.stops.map((s, idx) => (idx === i ? { ...s, hexString: picked } : s)) });
  };

  const handleAddStop = () => {
    if (gradient.stops.length >= 5) return;
    const sorted = [...gradient.stops].sort((a, b) => a.offset - b.offset);
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2] ?? sorted[0];
    const newOffset = (prev.offset + last.offset) / 2;
    onChange({ ...gradient, stops: [...gradient.stops, { hexString: last.hexString, offset: newOffset }] });
  };

  const handleRemoveStop = (i: number) => {
    if (gradient.stops.length <= 2) return; // always keep at least 2 stops
    onChange({ ...gradient, stops: gradient.stops.filter((_, idx) => idx !== i) });
  };

  const handleStyleSelect = (opt: (typeof STYLE_OPTIONS)[number]) => {
    onChange({ ...gradient, shape: opt.shape, angle: opt.angle });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      <SegmentedControl
        options={[
          { value: "solid", label: "Solid" },
          { value: "gradient", label: "Gradient" },
        ]}
        value={tab}
        onChange={handleTabChange}
      />

      {tab === "solid" ? (
        <Swatch
          fill={[value.type === "solid" ? value.hexString : "#000000"]}
          onClick={async (e) => {
            const picked = await pickSolidColor(anchorFromEvent(e), value.type === "solid" ? value.hexString : "#000000");
            if (picked) onChange({ type: "solid", hexString: picked });
          }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Text size="small" variant="bold">
              Gradient colours
            </Text>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {gradient.stops.map((s, i) => (
                <StopCircle
                  key={i}
                  hex={s.hexString}
                  onClick={(e) => handleStopClick(e, i)}
                  onRemove={() => handleRemoveStop(i)}
                  canRemove={gradient.stops.length > 2}
                />
              ))}
              <button
                type="button"
                onClick={handleAddStop}
                disabled={gradient.stops.length >= 5}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "2px dashed #c0c0c0",
                  background: "#fafafa",
                  cursor: gradient.stops.length >= 5 ? "not-allowed" : "pointer",
                  opacity: gradient.stops.length >= 5 ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  lineHeight: 1,
                  color: "#666",
                  padding: 0,
                }}
              >
                +
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Text size="small" variant="bold">
              Style
            </Text>
            <div style={FOUR_COLUMN_GRID}>
              {STYLE_OPTIONS.map((opt, i) => {
                const previewGradient: GradientColor = { ...gradient, shape: opt.shape, angle: opt.angle };
                const isSelected = gradient.shape === opt.shape && (opt.shape === "radial" || gradient.angle === opt.angle);
                return (
                  <StretchSwatch
                    key={i}
                    background={toCssBackground(previewGradient)}
                    isSelected={isSelected}
                    onClick={() => handleStyleSelect(opt)}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Text size="small" variant="bold">
              Presets
            </Text>
            <div style={FOUR_COLUMN_GRID}>
              {PRESETS.map((preset, i) => (
                <StretchSwatch
                  key={i}
                  background={toCssBackground(preset)}
                  isSelected={isSameGradient(gradient, preset)}
                  onClick={() => onChange(preset)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GradientColorField;