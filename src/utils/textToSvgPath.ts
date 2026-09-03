// src/utils/textToSvgPath.ts
import * as opentype from "opentype.js";

const cachedFonts = new Map<string, opentype.Font>();

// Font file is loaded once and cached. opentype.js needs the actual
// font binary to compute each letter's outline (unlike Canvas, which
// just needed a CSS font-family string).
export async function loadFont(fontUrl: string): Promise<opentype.Font> {
  const cachedFont = cachedFonts.get(fontUrl);
  if (cachedFont) {
    return cachedFont;
  }

  const response = await fetch(fontUrl);
  if (!response.ok) {
    throw new Error(`Failed to load font: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const font = opentype.parse(buffer);
  cachedFonts.set(fontUrl, font);
  return font;
}

export function textToSvgPathData(
  font: opentype.Font,
  text: string,
  x: number,
  y: number,
  fontSize: number,
): string {
  const path = font.getPath(text, x, y, fontSize);
  return path.toPathData(2);
}
