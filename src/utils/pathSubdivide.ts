// src/utils/pathSubdivide.ts
// Warping moves each Bezier control point independently through a
// (often nonlinear) transform. For curves with few, long segments —
// common in some bold/geometric fonts — moving just 2 control points
// independently can make the curve balloon out or self-intersect,
// showing up as a missing chunk of a letter plus a stray fragment
// elsewhere. Fix: flatten each curve into many short line segments in
// the glyph's ORIGINAL coordinate space (where the curve math is exact)
// BEFORE transforming, then transform each of those points individually.
// With enough segments the polyline closely approximates the true
// warped curve regardless of how nonlinear the transform is.

interface PathCommand {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

const SEGMENTS_PER_CURVE = 32;

function cubicPoint(
  p0x: number, p0y: number,
  c1x: number, c1y: number,
  c2x: number, c2y: number,
  p1x: number, p1y: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: mt3 * p0x + 3 * mt2 * t * c1x + 3 * mt * t2 * c2x + t3 * p1x,
    y: mt3 * p0y + 3 * mt2 * t * c1y + 3 * mt * t2 * c2y + t3 * p1y,
  };
}

function quadPoint(
  p0x: number, p0y: number,
  cx: number, cy: number,
  p1x: number, p1y: number,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * p0x + 2 * mt * t * cx + t * t * p1x,
    y: mt * mt * p0y + 2 * mt * t * cy + t * t * p1y,
  };
}

// Replaces every C/Q command with a run of L commands sampled along the
// original curve. M/L/Z pass through unchanged. Must run BEFORE any
// point-wise warp transform is applied to the commands — and also makes
// path.getBoundingBox() afterwards more accurate, since it now reads
// real on-curve sample points instead of estimating from just the
// control points.
export function flattenCurves(commands: PathCommand[]): PathCommand[] {
  const out: PathCommand[] = [];
  let curX = 0;
  let curY = 0;

  for (const cmd of commands) {
    if (cmd.type === "M" || cmd.type === "L") {
      out.push(cmd);
      curX = cmd.x ?? curX;
      curY = cmd.y ?? curY;
    } else if (cmd.type === "C") {
      const { x1 = curX, y1 = curY, x2 = curX, y2 = curY, x = curX, y = curY } = cmd;
      for (let i = 1; i <= SEGMENTS_PER_CURVE; i++) {
        const t = i / SEGMENTS_PER_CURVE;
        const p = cubicPoint(curX, curY, x1, y1, x2, y2, x, y, t);
        out.push({ type: "L", x: p.x, y: p.y });
      }
      curX = x;
      curY = y;
    } else if (cmd.type === "Q") {
      const { x1 = curX, y1 = curY, x = curX, y = curY } = cmd;
      for (let i = 1; i <= SEGMENTS_PER_CURVE; i++) {
        const t = i / SEGMENTS_PER_CURVE;
        const p = quadPoint(curX, curY, x1, y1, x, y, t);
        out.push({ type: "L", x: p.x, y: p.y });
      }
      curX = x;
      curY = y;
    } else {
      out.push(cmd); // Z or anything else passes through as-is.
    }
  }

  return out;
}