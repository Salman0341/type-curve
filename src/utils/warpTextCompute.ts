import type opentype from "opentype.js";
import type {
  CustomMeshState} from "./customWarpMath";
import {
  DEFAULT_CUSTOM_MESH,
  createCustomMeshTransformer,
} from "./customWarpMath";
import type { TextBounds } from "./warpTransformers";
import {
  createBulgeTransformer,
  createRiseDecreaseTransformer,
  createRiseIncreaseTransformer,
} from "./warpTransformers";

// The single source of truth for what a "warp effect" can be — everything
// else (StylePresetPicker's presets, useSvgTextWarp) imports this instead
// of redefining it, which is what caused the earlier "arch"/"flag" mismatch.
export type WarpEffect = "bulge" | "rise-decrease" | "rise-increase" | "custom";

export interface ComputedWarp {
  pathData: string;
  viewBox: string;
  textBounds: { x: number; y: number; w: number; h: number };
}

// Plain function, no React/hooks involved — safe to call directly inside a
// .map() for N thumbnails without violating rules of hooks, and safe to
// call from useSvgTextWarp for the main preview. Both paths run through
// this exact same code, so they can never visually disagree.
export function computeWarpedText(
  font: opentype.Font,
  text: string,
  effect: WarpEffect,
  customMesh: CustomMeshState = DEFAULT_CUSTOM_MESH,
): ComputedWarp | null {
  if (!text || !text.trim()) return null;

  const path = font.getPath(text, 0, 0, 72);
  if (!path || !path.commands || path.commands.length === 0) return null;

  const bb = path.getBoundingBox();
  const width = Math.max(bb.x2 - bb.x1, 10);
  const height = Math.max(bb.y2 - bb.y1, 10);
  const naturalTextBounds = { x: bb.x1, y: bb.y1, w: width, h: height };

  if (effect === "custom") {
    const safeMesh =
      customMesh &&
      Array.isArray(customMesh.points) &&
      (customMesh.points.length === 8 ||
        customMesh.points.length === 10 ||
        customMesh.points.length === 12)
        ? customMesh
        : DEFAULT_CUSTOM_MESH;
    const transform = createCustomMeshTransformer(safeMesh);

    const transformPoint = (px: number, py: number) => {
      const relX = px - bb.x1;
      const relY = py - bb.y1;
      const res = transform(relX, relY, width, height);
      return { x: bb.x1 + res.x, y: bb.y1 + res.y };
    };

    path.commands = path.commands.map((cmd: any) => {
      const c = { ...cmd };
      if (typeof c.x === "number" && typeof c.y === "number") {
        const p = transformPoint(c.x, c.y);
        c.x = p.x;
        c.y = p.y;
      }
      if (typeof c.x1 === "number" && typeof c.y1 === "number") {
        const p1 = transformPoint(c.x1, c.y1);
        c.x1 = p1.x;
        c.y1 = p1.y;
      }
      if (typeof c.x2 === "number" && typeof c.y2 === "number") {
        const p2 = transformPoint(c.x2, c.y2);
        c.x2 = p2.x;
        c.y2 = p2.y;
      }
      return c;
    });
  } else {
    const bounds: TextBounds = {
      minX: bb.x1,
      maxX: bb.x2,
      minY: bb.y1,
      maxY: bb.y2,
    };
    const pointTransform =
      effect === "rise-decrease"
        ? createRiseDecreaseTransformer(bounds)
        : effect === "rise-increase"
          ? createRiseIncreaseTransformer(bounds)
          : createBulgeTransformer(bounds);

    path.commands = path.commands.map((cmd: any) => {
      const c = { ...cmd };
      if (typeof c.x === "number" && typeof c.y === "number") {
        const p = pointTransform(c.x, c.y);
        c.x = p.x;
        c.y = p.y;
      }
      if (typeof c.x1 === "number" && typeof c.y1 === "number") {
        const p1 = pointTransform(c.x1, c.y1);
        c.x1 = p1.x;
        c.y1 = p1.y;
      }
      if (typeof c.x2 === "number" && typeof c.y2 === "number") {
        const p2 = pointTransform(c.x2, c.y2);
        c.x2 = p2.x;
        c.y2 = p2.y;
      }
      return c;
    });
  }

  const warpedBB = path.getBoundingBox();
  const warpedWidth = Math.max(warpedBB.x2 - warpedBB.x1, 10);
  const warpedHeight = Math.max(warpedBB.y2 - warpedBB.y1, 10);
  const padding = 20;
  const viewBox = `${Math.floor(warpedBB.x1 - padding)} ${Math.floor(
    warpedBB.y1 - padding,
  )} ${Math.floor(warpedWidth + padding * 2)} ${Math.floor(warpedHeight + padding * 2)}`;

  return {
    pathData: path.toPathData(3),
    viewBox,
    textBounds: naturalTextBounds,
  };
}
