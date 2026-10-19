// src/utils/customWarpMath.ts

export interface Point2D {
  x: number;
  y: number;
}

export interface CustomMeshPoint {
  id: string;
  x: number; // 0 to 1 relative
  y: number; // relative Y
}

export interface CustomMeshState {
  topPoints: CustomMeshPoint[];
  bottomPoints: CustomMeshPoint[];
  points?: Point2D[]; // Legacy compatibility for parent engine
}

export const DEFAULT_CUSTOM_MESH: CustomMeshState = {
  topPoints: [
    { id: "t-0", x: 0.0, y: 0.0 },
    { id: "t-1", x: 0.5, y: 0.0 },
    { id: "t-2", x: 1.0, y: 0.0 },
  ],
  bottomPoints: [
    { id: "b-0", x: 0.0, y: 1.0 },
    { id: "b-1", x: 0.5, y: 1.0 },
    { id: "b-2", x: 1.0, y: 1.0 },
  ],
};

// Smooth 2D Catmull-Rom Spline with Quadratic Endpoint Curvature Preservation
export function evaluateSpline2D(points: Point2D[] | CustomMeshPoint[], t: number): Point2D {
  if (!points || points.length === 0) return { x: t, y: 0 };
  const n = points.length;
  if (n === 1) return { x: points[0].x, y: points[0].y };

  const clampT = Math.max(0, Math.min(1, t));
  if (n === 2) {
    return {
      x: points[0].x * (1 - clampT) + points[1].x * clampT,
      y: points[0].y * (1 - clampT) + points[1].y * clampT,
    };
  }

  const totalSegments = n - 1;
  const tGlobal = clampT * totalSegments;
  const i = Math.min(Math.floor(tGlobal), totalSegments - 1);
  const s = tGlobal - i;

  const p1 = points[i];
  const p2 = points[i + 1];

  const p0 =
    i > 0
      ? points[i - 1]
      : {
          x: 3 * points[0].x - 3 * points[1].x + points[2].x,
          y: 3 * points[0].y - 3 * points[1].y + points[2].y,
        };

  const p3 =
    i + 2 < n
      ? points[i + 2]
      : {
          x: 3 * points[n - 1].x - 3 * points[n - 2].x + points[n - 3].x,
          y: 3 * points[n - 1].y - 3 * points[n - 2].y + points[n - 3].y,
        };

  const s2 = s * s;
  const s3 = s2 * s;

  const evalAxis = (c0: number, c1: number, c2: number, c3: number) =>
    0.5 *
    (2 * c1 +
      (-c0 + c2) * s +
      (2 * c0 - 5 * c1 + 4 * c2 - c3) * s2 +
      (-c0 + 3 * c1 - 3 * c2 + c3) * s3);

  return {
    x: evalAxis(p0.x, p1.x, p2.x, p3.x),
    y: evalAxis(p0.y, p1.y, p2.y, p3.y),
  };
}

export const evaluateCurveAtX = evaluateSpline2D;

export function sampleCurve(points: CustomMeshPoint[], steps: number = 40): Point2D[] {
  if (!points || points.length === 0) return [];
  const curve: Point2D[] = [];
  for (let s = 0; s <= steps; s++) {
    curve.push(evaluateSpline2D(points, s / steps));
  }
  return curve;
}

// Rotate manual mesh points around center by angleDeg (0° - 360°)
export function rotateCustomMesh(
  baseMesh: CustomMeshState,
  angleDeg: number,
  textAspectRatio: number = 3.0
): CustomMeshState {
  const safe = normalizeCustomMesh(baseMesh);
  const all = [...safe.topPoints, ...safe.bottomPoints];
  if (all.length === 0) return safe;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of all) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const ar = Math.max(0.2, textAspectRatio);

  const rotatePt = (pt: CustomMeshPoint): CustomMeshPoint => {
    const dx = pt.x - cx;
    const dy = (pt.y - cy) / ar;
    const rx = dx * cosA - dy * sinA;
    const ry = dx * sinA + dy * cosA;
    return {
      ...pt,
      x: Number((cx + rx).toFixed(4)),
      y: Number((cy + ry * ar).toFixed(4)),
    };
  };

  return normalizeCustomMesh({
    topPoints: safe.topPoints.map(rotatePt),
    bottomPoints: safe.bottomPoints.map(rotatePt),
  });
}

export function normalizeCustomMesh(mesh?: CustomMeshState | null): CustomMeshState {
  if (!mesh) return JSON.parse(JSON.stringify(DEFAULT_CUSTOM_MESH));

  let topPoints: CustomMeshPoint[];
  let bottomPoints: CustomMeshPoint[];

  if (Array.isArray(mesh.topPoints) && Array.isArray(mesh.bottomPoints) && mesh.topPoints.length > 0) {
    topPoints = mesh.topPoints.map((p, i) => ({
      id: p.id || `t-${i}`,
      x: Number.isFinite(p.x) ? p.x : i / Math.max(1, mesh.topPoints.length - 1),
      y: Number.isFinite(p.y) ? p.y : 0,
    }));
    bottomPoints = mesh.bottomPoints.map((p, i) => ({
      id: p.id || `b-${i}`,
      x: Number.isFinite(p.x) ? p.x : i / Math.max(1, mesh.bottomPoints.length - 1),
      y: Number.isFinite(p.y) ? p.y : 1,
    }));
  } else {
    return JSON.parse(JSON.stringify(DEFAULT_CUSTOM_MESH));
  }

  const legacyPoints: Point2D[] = [
    evaluateSpline2D(topPoints, 0.0),
    evaluateSpline2D(topPoints, 0.25),
    evaluateSpline2D(topPoints, 0.5),
    evaluateSpline2D(topPoints, 0.75),
    evaluateSpline2D(topPoints, 1.0),
    evaluateSpline2D(bottomPoints, 0.0),
    evaluateSpline2D(bottomPoints, 0.25),
    evaluateSpline2D(bottomPoints, 0.5),
    evaluateSpline2D(bottomPoints, 0.75),
    evaluateSpline2D(bottomPoints, 1.0),
  ];

  return { topPoints, bottomPoints, points: legacyPoints };
}

export function evalMeshRow(row: Point2D[], t: number): Point2D {
  if (!row || row.length === 0) return { x: 0, y: 0 };
  return evaluateSpline2D(row, t);
}

export function createCustomMeshTransformer(mesh: CustomMeshState) {
  const safe = normalizeCustomMesh(mesh);

  return (localX: number, localY: number, width: number, height: number): Point2D => {
    const u = width > 0 ? localX / width : 0;
    const v = height > 0 ? localY / height : 0;

    const top = evaluateSpline2D(safe.topPoints, u);
    const bottom = evaluateSpline2D(safe.bottomPoints, u);

    const finalX = (top.x * (1 - v) + bottom.x * v) * width;
    const finalY = (top.y * (1 - v) + bottom.y * v) * height;

    return { x: finalX, y: finalY };
  };
}