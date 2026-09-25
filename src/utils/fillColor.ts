// src/utils/fillColor.ts

// A single color value that every part of the app can now be: either a
// plain solid color (what "color: string" used to be everywhere), or a
// multi-stop gradient. Both are plain, JSON-serializable data — safe to
// store in TextWarpAppElementData (well under the 5KB app-element limit
// for any reasonable number of stops).

export interface SolidColor {
  type: "solid";
  hexString: string;
}

export interface GradientStop {
  hexString: string;
  offset: number; // 0 to 1
}

export type GradientShape = "linear" | "radial";

export interface GradientColor {
  type: "gradient";
  shape: GradientShape;
  angle: number; // degrees, used when shape === "linear"; ignored for radial
  stops: GradientStop[]; // at least 2, ordered by offset
}

export type FillColor = SolidColor | GradientColor;

export const DEFAULT_FILL_COLOR: FillColor = {
  type: "solid",
  hexString: "#000000",
};

export function isGradient(color: FillColor): color is GradientColor {
  return color.type === "gradient";
}

// A representative solid hex for places that can't render a gradient
// (e.g. stroke outlines, or any legacy string-only consumer) — uses the
// first stop.
export function toRepresentativeHex(color: FillColor): string {
  if (color.type === "solid") return color.hexString;
  return color.stops[0]?.hexString ?? "#000000";
}

// CSS `background` value for HTML previews (Swatch buttons, style
// thumbnails rendered as plain <div>s rather than SVG).
export function toCssBackground(color: FillColor): string {
  if (color.type === "solid") return color.hexString;
  const stopsCss = color.stops
    .slice()
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.hexString} ${Math.round(s.offset * 100)}%`)
    .join(", ");
  return color.shape === "radial"
    ? `radial-gradient(circle, ${stopsCss})`
    : `linear-gradient(${color.angle}deg, ${stopsCss})`;
}

// SVG needs a <defs><linearGradient>/<radialGradient> element plus a
// fill="url(#id)" reference — this returns both, ready to splice into
// any SVG markup string or JSX.
export function toSvgFill(
  color: FillColor,
  gradientId: string,
): { fillAttr: string; defsMarkup: string } {
  if (color.type === "solid") {
    return { fillAttr: color.hexString, defsMarkup: "" };
  }

  const sortedStops = color.stops
    .slice()
    .sort((a, b) => a.offset - b.offset);
  const stopsMarkup = sortedStops
    .map(
      (s) =>
        `<stop offset="${Math.round(s.offset * 100)}%" stop-color="${s.hexString}" />`,
    )
    .join("");

  let defsMarkup: string;
  if (color.shape === "radial") {
    defsMarkup = `<radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%">${stopsMarkup}</radialGradient>`;
  } else {
    // Convert an angle in degrees to x1/y1/x2/y2 on the unit square,
    // matching CSS linear-gradient angle conventions (0deg = bottom to
    // top, increasing clockwise).
    const rad = ((color.angle - 90) * Math.PI) / 180;
    const x1 = 50 - Math.cos(rad) * 50;
    const y1 = 50 - Math.sin(rad) * 50;
    const x2 = 50 + Math.cos(rad) * 50;
    const y2 = 50 + Math.sin(rad) * 50;
    defsMarkup = `<linearGradient id="${gradientId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stopsMarkup}</linearGradient>`;
  }

  return { fillAttr: `url(#${gradientId})`, defsMarkup };
}