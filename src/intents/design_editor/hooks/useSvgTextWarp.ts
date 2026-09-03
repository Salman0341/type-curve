import { useState, useEffect } from "react";
import opentype from "opentype.js";
import {
  EnvelopeMeshState,
  DEFAULT_ENVELOPE_MESH,
  createEnvelopeTransformer,
} from "../../../utils/customWarpMath";

export type WarpEffect = "bulge" | "arch" | "flag" | "custom";

interface UseSvgTextWarpProps {
  text: string;
  effect: WarpEffect;
  fontUrl: string;
  customMesh?: EnvelopeMeshState;
}

export function useSvgTextWarp({
  text,
  effect,
  fontUrl,
  customMesh = DEFAULT_ENVELOPE_MESH,
}: UseSvgTextWarpProps) {
  const [pathData, setPathData] = useState<string>("");
  const [viewBox, setViewBox] = useState<string>("0 0 320 180");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function renderWarp() {
      // 1. Text Empty Check
      if (!text || !text.trim()) {
        if (isMounted) {
          setPathData("");
          setIsLoading(false);
        }
        return;
      }

      try {
        if (isMounted) {
          setIsLoading(true);
          setError(null);
        }

        // 2. Safe Font Loading (Error Catching)
        let font: opentype.Font | null = null;
        try {
          font = await opentype.load(fontUrl);
        } catch (fErr) {
          throw new Error("Font file URL not reachable or invalid.");
        }

        if (!isMounted) return;

        // CRITICAL FIX: Ensure 'font' is defined before calling getPath
        if (!font || typeof font.getPath !== "function") {
          throw new Error("Opentype font instance is undefined.");
        }

        // 3. Generate Base Path
        const path = font.getPath(text, 0, 0, 72);
        if (!path || !path.commands || path.commands.length === 0) {
          throw new Error("Could not extract glyph path from text.");
        }

        const bb = path.getBoundingBox();
        const width = Math.max(bb.x2 - bb.x1, 10);
        const height = Math.max(bb.y2 - bb.y1, 10);
        const padding = 40;

        const currentViewBox = `${Math.floor(bb.x1 - padding)} ${Math.floor(
          bb.y1 - padding
        )} ${Math.floor(width + padding * 2)} ${Math.floor(height + padding * 2)}`;

        if (isMounted) {
          setViewBox(currentViewBox);
        }

        // 4. PREMADE STYLES & CUSTOM ISOLATION
        if (effect === "custom") {
          // Custom Mesh Transformation
          const activeMesh =
            customMesh && customMesh.top ? customMesh : DEFAULT_ENVELOPE_MESH;
          const transform = createEnvelopeTransformer(activeMesh);

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
          // Premade Styles Simple Warp Math
          path.commands = path.commands.map((cmd: any) => {
            const c = { ...cmd };
            if (typeof c.x === "number" && typeof c.y === "number") {
              const normX = (c.x - bb.x1) / width; // 0 to 1
              let offset = 0;

              if (effect === "arch") {
                offset = -Math.sin(normX * Math.PI) * (height * 0.4);
              } else if (effect === "bulge") {
                const factor = Math.sin(normX * Math.PI);
                const relY = (c.y - bb.y1) - height / 2;
                offset = relY * factor * 0.5;
              } else if (effect === "flag") {
                offset = Math.sin(normX * Math.PI * 2) * (height * 0.25);
              }

              c.y += offset;
            }
            return c;
          });
        }

        if (isMounted) {
          const generatedPath = path.toPathData(3);
          setPathData(generatedPath);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Text Warp Render Error:", err);
          setError(err?.message || "Failed to render text path");
          setIsLoading(false);
        }
      }
    }

    renderWarp();

    return () => {
      isMounted = false;
    };
  }, [text, effect, fontUrl, JSON.stringify(customMesh)]);

  return { pathData, viewBox, isLoading, error };
}
