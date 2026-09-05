export interface Point2D {
  x: number;
  y: number;
}

export interface MeshPoint {
  x: number;
  y: number;
}

// 1. Envelope / Custom Mesh State Types
export interface EnvelopeMeshState {
  top: { p0: Point2D; c1: Point2D; c2: Point2D; p1: Point2D };
  bottom: { p0: Point2D; c1: Point2D; c2: Point2D; p1: Point2D };
  left: { p0: Point2D; c1: Point2D; c2: Point2D; p1: Point2D };
  right: { p0: Point2D; c1: Point2D; c2: Point2D; p1: Point2D };
}

// 10 draggable points, matching Canva-style text handles:
// 0-4 top row left-to-right, 5-9 bottom row left-to-right.
export interface CustomMeshState {
  points: MeshPoint[];
}

// 2. Default State Fallbacks
export const DEFAULT_ENVELOPE_MESH: EnvelopeMeshState = {
  top: { p0: { x: 0, y: 0 }, c1: { x: 0.33, y: 0 }, c2: { x: 0.66, y: 0 }, p1: { x: 1, y: 0 } },
  bottom: { p0: { x: 0, y: 1 }, c1: { x: 0.33, y: 1 }, c2: { x: 0.66, y: 1 }, p1: { x: 1, y: 1 } },
  left: { p0: { x: 0, y: 0 }, c1: { x: 0, y: 0.33 }, c2: { x: 0, y: 0.66 }, p1: { x: 0, y: 1 } },
  right: { p0: { x: 1, y: 0 }, c1: { x: 1, y: 0.33 }, c2: { x: 1, y: 0.66 }, p1: { x: 1, y: 1 } },
};

export const DEFAULT_CUSTOM_MESH: CustomMeshState = {
  points: [
    { x: 0, y: 0 },    // 0 top-left
    { x: 0.25, y: 0 }, // 1 top-inner-left
    { x: 0.5, y: 0 },  // 2 top-mid
    { x: 0.75, y: 0 }, // 3 top-inner-right
    { x: 1, y: 0 },    // 4 top-right
    { x: 0, y: 1 },    // 5 bottom-left
    { x: 0.25, y: 1 }, // 6 bottom-inner-left
    { x: 0.5, y: 1 },  // 7 bottom-mid
    { x: 0.75, y: 1 }, // 8 bottom-inner-right
    { x: 1, y: 1 },    // 9 bottom-right
  ],
};

// 3. Helper Functions
export function safeNumber(val: number, fallback = 0): number {
  return Number.isFinite(val) ? val : fallback;
}

function evalCubicBezier(p0: Point2D, c1: Point2D, c2: Point2D, p1: Point2D, t: number): Point2D {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * c1.x + 3 * mt * t2 * c2.x + t3 * p1.x,
    y: mt3 * p0.y + 3 * mt2 * t * c1.y + 3 * mt * t2 * c2.y + t3 * p1.y,
  };
}

// 4. Transform Math Engine
export function createEnvelopeTransformer(mesh: EnvelopeMeshState = DEFAULT_ENVELOPE_MESH) {
  const safeMesh = mesh && mesh.top ? mesh : DEFAULT_ENVELOPE_MESH;

  return (x: number, y: number, width: number, height: number) => {
    if (!width || !height) return { x, y };

    const u = Math.min(Math.max(x / width, 0), 1);
    const v = Math.min(Math.max(y / height, 0), 1);

    const topPt = evalCubicBezier(safeMesh.top.p0, safeMesh.top.c1, safeMesh.top.c2, safeMesh.top.p1, u);
    const botPt = evalCubicBezier(safeMesh.bottom.p0, safeMesh.bottom.c1, safeMesh.bottom.c2, safeMesh.bottom.p1, u);
    const leftPt = evalCubicBezier(safeMesh.left.p0, safeMesh.left.c1, safeMesh.left.c2, safeMesh.left.p1, v);
    const rightPt = evalCubicBezier(safeMesh.right.p0, safeMesh.right.c1, safeMesh.right.c2, safeMesh.right.p1, v);

    const cornerP00 = safeMesh.top.p0;
    const cornerP10 = safeMesh.top.p1;
    const cornerP01 = safeMesh.bottom.p0;
    const cornerP11 = safeMesh.bottom.p1;

    const bilinearX =
      (1 - u) * (1 - v) * cornerP00.x +
      u * (1 - v) * cornerP10.x +
      (1 - u) * v * cornerP01.x +
      u * v * cornerP11.x;

    const bilinearY =
      (1 - u) * (1 - v) * cornerP00.y +
      u * (1 - v) * cornerP10.y +
      (1 - u) * v * cornerP01.y +
      u * v * cornerP11.y;

    const finalX = (1 - v) * topPt.x + v * botPt.x + (1 - u) * leftPt.x + u * rightPt.x - bilinearX;
    const finalY = (1 - v) * topPt.y + v * botPt.y + (1 - u) * leftPt.y + u * rightPt.y - bilinearY;

    return {
      x: safeNumber(finalX * width, x),
      y: safeNumber(finalY * height, y),
    };
  };
}

// 5. Convert 8 draggable points -> EnvelopeMeshState
function quadControlFromMidpoint(p0: Point2D, mid: Point2D, p1: Point2D): Point2D {
  return {
    x: 2 * mid.x - 0.5 * p0.x - 0.5 * p1.x,
    y: 2 * mid.y - 0.5 * p0.y - 0.5 * p1.y,
  };
}

function cubicFromQuad(p0: Point2D, q: Point2D, p1: Point2D): { c1: Point2D; c2: Point2D } {
  return {
    c1: { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) },
    c2: { x: p1.x + (2 / 3) * (q.x - p1.x), y: p1.y + (2 / 3) * (q.y - p1.y) },
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPoint(a: Point2D, b: Point2D, t: number): Point2D {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

export function normalizeCustomMesh(mesh?: CustomMeshState): CustomMeshState {
  const points = mesh?.points;

  if (Array.isArray(points) && points.length === 10) {
    return { points };
  }

  if (Array.isArray(points) && points.length === 8) {
    const [tl, tm, tr, , br, bm, bl] = points;
    if (!tl || !tm || !tr || !br || !bm || !bl) {
      return DEFAULT_CUSTOM_MESH;
    }

    return {
      points: [
        tl,
        lerpPoint(tl, tm, 0.5),
        tm,
        lerpPoint(tm, tr, 0.5),
        tr,
        bl,
        lerpPoint(bl, bm, 0.5),
        bm,
        lerpPoint(bm, br, 0.5),
        br,
      ],
    };
  }

  return DEFAULT_CUSTOM_MESH;
}

// Catmull-Rom spline through ALL points of a row (exactly, not just its
// neighbors) — this is what makes the curve look like the reference's
// smooth diamond instead of a straight-segment polyline. Every one of the
// 5 points per row (including the two "inner" quarter points) genuinely
// bends the curve, since the spline passes through each of them exactly.
function catmullRomPoint(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export function evalMeshRow(row: MeshPoint[], u: number): Point2D {
  const n = row.length;
  if (n === 0) return { x: u, y: 0 };
  if (n === 1) return row[0];

  const clampedU = Math.min(Math.max(u, 0), 1);
  const scaled = clampedU * (n - 1);
  const i = Math.min(Math.floor(scaled), n - 2);
  const t = scaled - i;

  const p0 = row[Math.max(i - 1, 0)];
  const p1 = row[i];
  const p2 = row[i + 1];
  const p3 = row[Math.min(i + 2, n - 1)];

  return catmullRomPoint(p0, p1, p2, p3, t);
}

export function pointsToEnvelopeMesh(points: MeshPoint[]): EnvelopeMeshState {
  const safePoints =
    Array.isArray(points) && points.length === 8
      ? points
      : normalizeCustomMesh({ points }).points;

  if (safePoints.length === 10) {
    const [tl, , tm, , tr, bl, , bm, , br] = safePoints;
    if (!tl || !tm || !tr || !bl || !bm || !br) {
      return DEFAULT_ENVELOPE_MESH;
    }

    const lm = lerpPoint(tl, bl, 0.5);
    const rm = lerpPoint(tr, br, 0.5);

    const topQ = quadControlFromMidpoint(tl, tm, tr);
    const bottomQ = quadControlFromMidpoint(bl, bm, br);
    const leftQ = quadControlFromMidpoint(tl, lm, bl);
    const rightQ = quadControlFromMidpoint(tr, rm, br);

    return {
      top: { p0: tl, ...cubicFromQuad(tl, topQ, tr), p1: tr },
      bottom: { p0: bl, ...cubicFromQuad(bl, bottomQ, br), p1: br },
      left: { p0: tl, ...cubicFromQuad(tl, leftQ, bl), p1: bl },
      right: { p0: tr, ...cubicFromQuad(tr, rightQ, br), p1: br },
    };
  }

  const [tl, tm, tr, rm, br, bm, bl, lm] = safePoints;
  if (!tl || !tm || !tr || !rm || !br || !bm || !bl || !lm) {
    return DEFAULT_ENVELOPE_MESH;
  }

  const topQ = quadControlFromMidpoint(tl, tm, tr);
  const bottomQ = quadControlFromMidpoint(bl, bm, br);
  const leftQ = quadControlFromMidpoint(tl, lm, bl);
  const rightQ = quadControlFromMidpoint(tr, rm, br);

  return {
    top: { p0: tl, ...cubicFromQuad(tl, topQ, tr), p1: tr },
    bottom: { p0: bl, ...cubicFromQuad(bl, bottomQ, br), p1: br },
    left: { p0: tl, ...cubicFromQuad(tl, leftQ, bl), p1: bl },
    right: { p0: tr, ...cubicFromQuad(tr, rightQ, br), p1: br },
  };
}

// One-call transformer builder for the custom mesh — now driven by the
// Catmull-Rom row curve so the actual warped text follows a smooth curve
// through every point, not straight segments between them.
export function createCustomMeshTransformer(mesh: CustomMeshState = DEFAULT_CUSTOM_MESH) {
  const safeMesh = normalizeCustomMesh(mesh);
  const topRow = safeMesh.points.slice(0, 5);
  const bottomRow = safeMesh.points.slice(5, 10);

  return (x: number, y: number, width: number, height: number) => {
    if (!width || !height) return { x, y };

    const u = Math.min(Math.max(x / width, 0), 1);
    const v = Math.min(Math.max(y / height, 0), 1);
    const top = evalMeshRow(topRow, u);
    const bottom = evalMeshRow(bottomRow, u);

    return {
      x: safeNumber(lerp(top.x, bottom.x, v) * width, x),
      y: safeNumber(lerp(top.y, bottom.y, v) * height, y),
    };
  };
}