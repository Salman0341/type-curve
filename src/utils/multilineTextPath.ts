// src/utils/multilineTextPath.ts
import type opentype from "opentype.js";

// font.getPath() only ever lays out a SINGLE line — it has no concept of
// "\n". For multi-line text, each line needs its own path (so each gets
// its own correct horizontal advance/kerning), those lines need to be
// horizontally centered against the widest line and vertically stacked
// by line height, and then merged into ONE combined path before any warp
// transform runs (the warp transform needs a single path to work on).
export function getMultilinePath(
  font: opentype.Font,
  text: string,
  fontSize: number,
  lineHeightMultiplier = 1.15,
) {
  const lines = text.split("\n");
  const lineHeight = fontSize * lineHeightMultiplier;

  // Each line's own advance width, so shorter lines center against the
  // widest one instead of all sitting flush left.
  const lineWidths = lines.map((line) => font.getAdvanceWidth(line || " ", fontSize));
  const maxWidth = Math.max(...lineWidths, 1);

  let combinedCommands: any[] = [];
  lines.forEach((line, i) => {
    const lineX = (maxWidth - lineWidths[i]) / 2;
    const lineY = i * lineHeight;
    const linePath = font.getPath(line || " ", lineX, lineY, fontSize);
    combinedCommands = combinedCommands.concat(linePath.commands as any[]);
  });

  // Reuse a real opentype.Path instance (from the first line) and swap
  // in the combined commands — every method the rest of the codebase
  // relies on (getBoundingBox, toPathData) just reads from .commands,
  // so this avoids needing a direct import of the Path constructor
  // while staying 100% compatible with the existing single-line code.
  const basePath = font.getPath(lines[0] || " ", 0, 0, fontSize);
  basePath.commands = combinedCommands;
  return basePath;
}

// How many lines the text has and the tallest line's rendered width —
// used by the editor's fallback estimate (before real font metrics are
// available) so the placeholder box accounts for line count too.
export function getLineInfo(text: string): { lineCount: number; longestLine: string } {
  const lines = (text || "").split("\n");
  const longestLine = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
  return { lineCount: Math.max(lines.length, 1), longestLine };
}