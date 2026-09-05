export interface TextBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type PointTransformer = (x: number, y: number) => { x: number; y: number };

/**
 * 1. Bulge / Spherize Transformer (Preset 1)
 */
export function createBulgeTransformer(bounds: TextBounds): PointTransformer {
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const cx = bounds.minX + width / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  const radiusX = width / 2;
  const radiusY = width * 0.46;

  return (x: number, y: number) => {
    const nx = Math.max(-1, Math.min(1, (x - cx) / radiusX));
    const arch = Math.sqrt(Math.max(0.01, 1 - nx * nx));

    const originalHalfHeight = (bounds.maxY - bounds.minY) / 2 || 1;
    const ny = (y - cy) / originalHalfHeight;

    const warpedY = cy + ny * arch * radiusY;

    return { x, y: warpedY };
  };
}

/**
 * 2. Perspective Shrink - Left Extreme Tall, Right Small (Preset 2 - Matching d2_2.png)
 */
export function createRiseDecreaseTransformer(bounds: TextBounds): PointTransformer {
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const minX = bounds.minX;
  const cy = (bounds.minY + bounds.maxY) / 2;

  const originalHalfHeight = (bounds.maxY - bounds.minY) / 2 || 1;

  // Extreme stretch ratio: Left side 3.5x tall, Right side shrinks to 0.35x
  const startScale = 3.5;
  const endScale = 0.35;

  return (x: number, y: number) => {
    const t = Math.max(0, Math.min(1, (x - minX) / width));
    const scale = startScale + (endScale - startScale) * t;

    const ny = (y - cy) / originalHalfHeight;
    const warpedY = cy + ny * originalHalfHeight * scale;

    return {
      x,
      y: warpedY,
    };
  };
}

/**
 * 3. Perspective Grow - Left Small, Right Extreme Tall (Preset 3 - Matching d3.png)
 */
export function createRiseIncreaseTransformer(bounds: TextBounds): PointTransformer {
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const minX = bounds.minX;
  const cy = (bounds.minY + bounds.maxY) / 2;

  const originalHalfHeight = (bounds.maxY - bounds.minY) / 2 || 1;

  // Extreme stretch ratio: Left side 0.35x small, Right side 3.5x tall
  const startScale = 0.35;
  const endScale = 3.5;

  return (x: number, y: number) => {
    const t = Math.max(0, Math.min(1, (x - minX) / width));
    const scale = startScale + (endScale - startScale) * t;

    const ny = (y - cy) / originalHalfHeight;
    const warpedY = cy + ny * originalHalfHeight * scale;

    return {
      x,
      y: warpedY,
    };
  };
}