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
  angle: number; // degrees
  stops: GradientStop[];
}

export type FillColor = SolidColor | GradientColor;

export const DEFAULT_FILL_COLOR: FillColor = {
  type: "solid",
  hexString: "#000000",
};

export function isGradient(color: FillColor): color is GradientColor {
  return Boolean(color && color.type === "gradient");
}

export function toRepresentativeHex(color: FillColor): string {
  if (!isGradient(color)) return color.hexString;
  return color.stops[0]?.hexString ?? "#000000";
}

export function toCssBackground(color: FillColor): string {
  if (!isGradient(color)) return color.hexString;
  const stopsCss = color.stops
    .slice()
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.hexString} ${Math.round(s.offset * 100)}%`)
    .join(", ");
  return color.shape === "radial"
    ? `radial-gradient(circle, ${stopsCss})`
    : `linear-gradient(${color.angle}deg, ${stopsCss})`;
}

export function toSvgFill(
  color: FillColor,
  gradientId: string,
): { fillAttr: string; defsMarkup: string } {
  if (!isGradient(color)) {
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
    defsMarkup = `<radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">${stopsMarkup}</radialGradient>`;
  } else {
    // Exact userSpaceOnUse mapping taake har warped path par gradient smoothly stretch ho
    const rad = ((color.angle ?? 90) * Math.PI) / 180;
    const x1 = Math.round(50 - Math.cos(rad) * 50);
    const y1 = Math.round(50 - Math.sin(rad) * 50);
    const x2 = Math.round(50 + Math.cos(rad) * 50);
    const y2 = Math.round(50 + Math.sin(rad) * 50);

    defsMarkup = `<linearGradient id="${gradientId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stopsMarkup}</linearGradient>`;
  }

  return { fillAttr: `url(#${gradientId})`, defsMarkup };
}