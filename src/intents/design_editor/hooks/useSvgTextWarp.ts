import { useState, useEffect, useRef } from "react";
import opentype from "opentype.js";
import {
  CustomMeshState,
  DEFAULT_CUSTOM_MESH,
  createCustomMeshTransformer,
} from "../../../utils/customWarpMath";
import type { TextBounds } from "../../../utils/warpTransformers";
import {
  createBulgeTransformer,
  createRiseDecreaseTransformer,
  createRiseIncreaseTransformer,
} from "../../../utils/warpTransformers";

// Matches the preset ids used in StylePresetPicker.tsx exactly — "arch"
// and "flag" were never real presets, they were dead branches that never
// matched anything and made rise-decrease/rise-increase silently no-op.
export type WarpEffect = "bulge" | "rise-decrease" | "rise-increase" | "custom";

interface UseSvgTextWarpProps {
  text: string;
  effect: WarpEffect;
  fontUrl: string;
  customMesh?: CustomMeshState;
}

export interface SvgTextBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export function useSvgTextWarp({
  text,
  effect,
  fontUrl,
  customMesh = DEFAULT_CUSTOM_MESH,
}: UseSvgTextWarpProps) {
  const [pathData, setPathData] = useState<string>("");
  const [viewBox, setViewBox] = useState<string>("0 0 320 180");
  const [textBounds, setTextBounds] = useState<SvgTextBounds | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadedFontRef = useRef<opentype.Font | null>(null);
  const currentFontUrlRef = useRef<string>("");

  useEffect(() => {
    let isMounted = true;

    async function processTextWarp() {
      if (!text || !text.trim()) {
        if (isMounted) {
          setPathData("");
          setTextBounds(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        if (isMounted && !loadedFontRef.current) {
          setIsLoading(true);
        }
        setError(null);

        // 1. ArrayBuffer Font Loading
        let font = loadedFontRef.current;

        if (!font || currentFontUrlRef.current !== fontUrl) {
          try {
            const response = await withTimeout(
              fetch(fontUrl),
              8000,
              "Font load timed out",
            );
            if (!response.ok) throw new Error(`Font fetch status: ${response.status}`);
            const buffer = await response.arrayBuffer();
            font = opentype.parse(buffer);

            loadedFontRef.current = font;
            currentFontUrlRef.current = fontUrl;
          } catch (fetchErr) {
            font = await withTimeout(
              new Promise<opentype.Font>((resolve, reject) => {
                opentype.load(fontUrl, (err, f) => {
                  if (err || !f) reject(err || new Error("Font load failed"));
                  else resolve(f);
                });
              }),
              8000,
              "Font load timed out",
            );
            loadedFontRef.current = font;
            currentFontUrlRef.current = fontUrl;
          }
        }

        if (!isMounted) return;

        if (!font || typeof font.getPath !== "function") {
          throw new Error("Opentype font engine failed");
        }

        // 2. Base Path Generation
        const path = font.getPath(text, 0, 0, 72);
        if (!path || !path.commands || path.commands.length === 0) {
          throw new Error("Could not parse text path");
        }

        const bb = path.getBoundingBox();
        const width = Math.max(bb.x2 - bb.x1, 10);
        const height = Math.max(bb.y2 - bb.y1, 10);
        const naturalTextBounds = {
          x: bb.x1,
          y: bb.y1,
          w: width,
          h: height,
        };

        // 3. Precise Transformation (Fixes Distortion & Misalignment)
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
          // Same premade transformers used by the export path
          // (useAddTextWarpToDesign.ts) — using the real functions here
          // instead of a separate approximation is what keeps the preview
          // and the final "Add to design" result identical.
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

        // 4. Recalculate Bounding Box After Deformation (Fixes Stretched Scaling)
        const warpedBB = path.getBoundingBox();
        const warpedWidth = Math.max(warpedBB.x2 - warpedBB.x1, 10);
        const warpedHeight = Math.max(warpedBB.y2 - warpedBB.y1, 10);
        const padding = 20;

        const calculatedViewBox = `${Math.floor(warpedBB.x1 - padding)} ${Math.floor(
          warpedBB.y1 - padding
        )} ${Math.floor(warpedWidth + padding * 2)} ${Math.floor(warpedHeight + padding * 2)}`;

        if (isMounted) {
          setViewBox(calculatedViewBox);
          setTextBounds(naturalTextBounds);
          setPathData(path.toPathData(3));
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Warp execution error:", err);
          setError(err?.message || "Failed to render path");
          setIsLoading(false);
        }
      }
    }

    processTextWarp();

    return () => {
      isMounted = false;
    };
  }, [text, effect, fontUrl, JSON.stringify(customMesh)]);

  return { pathData, viewBox, textBounds, isLoading, error };
}