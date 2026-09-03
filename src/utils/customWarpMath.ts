export interface Point2D {
  x: number;
  y: number;
}

export interface EnvelopeMeshState {
  top: { p0: Point2D; c1: Point2D; c2: Point2D; p1: Point2D };
  bottom: { p0: Point2D; c1: Point2D; c2: Point2D; p1: Point2D };
  left: { p0: Point2D; c1: Point2D; c2: Point2D; p1: Point2D };
  right: { p0: Point2D; c1: Point2D; c2: Point2D; p1: Point2D };
}

export const DEFAULT_ENVELOPE_MESH: EnvelopeMeshState = {
  top: {
    p0: { x: 0, y: 0 },
    c1: { x: 0.33, y: 0 },
    c2: { x: 0.66, y: 0 },
    p1: { x: 1, y: 0 },
  },
  bottom: {
    p0: { x: 0, y: 1 },
    c1: { x: 0.33, y: 1 },
    c2: { x: 0.66, y: 1 },
    p1: { x: 1, y: 1 },
  },
  left: {
    p0: { x: 0, y: 0 },
    c1: { x: 0, y: 0.33 },
    c2: { x: 0, y: 0.66 },
    p1: { x: 0, y: 1 },
  },
  right: {
    p0: { x: 1, y: 0 },
    c1: { x: 1, y: 0.33 },
    c2: { x: 1, y: 0.66 },
    p1: { x: 1, y: 1 },
  },
};

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
      x: finalX * width,
      y: finalY * height,
    };
  };
}

// Backward Compatibility Exports
export const DEFAULT_CUSTOM_MESH = DEFAULT_ENVELOPE_MESH;
export const createCustomMeshTransformer = createEnvelopeTransformer;
export type CustomMeshState = EnvelopeMeshState;