// src/utils/svgGradientDefs.tsx
import React from "react";
import type { FillColor } from "./fillColor";
import { isGradient } from "./fillColor";

export function getSvgFillAttr(color: FillColor, gradientId: string): string {
  if (!isGradient(color)) return color.hexString;
  return `url(#${gradientId})`;
}

export function SvgGradientDef({ color, id }: { color: FillColor; id: string }) {
  if (!isGradient(color)) return null;

  const sortedStops = [...color.stops].sort((a, b) => a.offset - b.offset);
  const stopEls = sortedStops.map((s, i) => (
    <stop key={i} offset={`${Math.round(s.offset * 100)}%`} stopColor={s.hexString} />
  ));

  if (color.shape === "radial") {
    return (
      <radialGradient id={id} cx="50%" cy="50%" r="50%">
        {stopEls}
      </radialGradient>
    );
  }

  const rad = ((color.angle - 90) * Math.PI) / 180;
  const x1 = 50 - Math.cos(rad) * 50;
  const y1 = 50 - Math.sin(rad) * 50;
  const x2 = 50 + Math.cos(rad) * 50;
  const y2 = 50 + Math.sin(rad) * 50;

  return (
    <linearGradient id={id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
      {stopEls}
    </linearGradient>
  );
}