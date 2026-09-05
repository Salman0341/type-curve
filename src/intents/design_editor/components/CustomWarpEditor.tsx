import React, { useRef, useCallback, useEffect, useMemo, useState } from "react";
import {
  CustomMeshState,
  DEFAULT_CUSTOM_MESH,
  Point2D,
  normalizeCustomMesh,
  evalMeshRow,
} from "../../../utils/customWarpMath";

interface CustomWarpEditorProps {
  text?: string;
  pathData?: string;
  textBounds?: Box | null;
  isLoading?: boolean;
  error?: string | null;
  mesh?: CustomMeshState;
  color?: string;
  onMeshChange?: (newMesh: CustomMeshState) => void;
  onBack?: () => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function estimateTextBox(text: string | undefined): Box {
  const safeText = text?.trim() || "HELLO, WORLD!";
  return {
    x: 0,
    y: -54,
    w: Math.max(safeText.length * 42, 160),
    h: 58,
  };
}

function hasUsableBounds(bounds: Box | null | undefined): bounds is Box {
  return Boolean(
    bounds &&
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      bounds.w > 0 &&
      bounds.h > 0,
  );
}

// Pads a tight text box into a roomier, closer-to-square canvas so points
// have real space to travel (the text box itself is only a small part of
// the reference editor's diamond canvas).
//
// FIX: margin is now a modest 35% fraction applied equally to both axes,
// using the ALREADY aspect-corrected w/h (which by this point are close to
// square). The previous version used marginY = h * 1.0 (100%) on that same
// post-correction h — since h had already been inflated to match the wide
// text's width (e.g. 588 for a 618-wide text), adding another full h on
// top and bottom tripled the total height (h + h + h ≈ 1764), which is
// exactly the runaway box size you were seeing. Points/text then rendered
// as a tiny cluster near the top of that oversized box.
function padToEditorBox(natural: Box): Box {
  const MAX_ASPECT = 1.05;
  let { x, y, w, h } = natural;

  w = Math.max(w, 10);
  h = Math.max(h, 10);

  if (w / h > MAX_ASPECT) {
    const desiredH = w / MAX_ASPECT;
    y -= (desiredH - h) / 2;
    h = desiredH;
  } else if (h / w > MAX_ASPECT) {
    const desiredW = h / w > MAX_ASPECT ? h / MAX_ASPECT : w;
    x -= (desiredW - w) / 2;
    w = desiredW;
  }

  const MARGIN_FRACTION = 0.35;
  const marginX = w * MARGIN_FRACTION;
  const marginY = h * MARGIN_FRACTION;
  return { x: x - marginX, y: y - marginY, w: w + marginX * 2, h: h + marginY * 2 };
}

export function CustomWarpEditor({
  text = "HELLO, WORLD!",
  pathData = "",
  textBounds,
  isLoading = false,
  error = null,
  mesh,
  color = "#000000",
  onMeshChange,
  onBack,
}: CustomWarpEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const safeMesh = useMemo(() => {
    return normalizeCustomMesh(mesh);
  }, [mesh]);

  const isIdentityMesh = useMemo(
    () => JSON.stringify(safeMesh.points) === JSON.stringify(DEFAULT_CUSTOM_MESH.points),
    [safeMesh]
  );

  const liveTextBox = useMemo(() => {
    if (hasUsableBounds(textBounds)) {
      return textBounds;
    }
    return estimateTextBox(text);
  }, [text, textBounds]);

  const canUseWarpedPath =
    hasUsableBounds(textBounds) && pathData && !pathData.includes("NaN");

  // The mesh's 0..1 point space is anchored to the text's NATURAL (untouched)
  // bounding box. While the mesh is still at its default/identity state we
  // keep tracking the live box (font/text can still be loading or changing).
  // The moment the user drags a point away from identity, we freeze it so
  // the canvas doesn't resize/jump under the user's cursor mid-drag.
  const [naturalBox, setNaturalBox] = useState<Box>(liveTextBox);
  useEffect(() => {
    if (isIdentityMesh) {
      setNaturalBox(liveTextBox);
    }
  }, [isIdentityMesh, liveTextBox]);

  // The actual SVG viewBox: natural text box + generous (but bounded) padding.
  const editorBox = useMemo(() => padToEditorBox(naturalBox), [naturalBox]);

  // Latest boxes in refs so the mousemove listener (added once per drag)
  // always reads current values instead of a stale closure.
  const editorBoxRef = useRef(editorBox);
  const naturalBoxRef = useRef(naturalBox);
  useEffect(() => {
    editorBoxRef.current = editorBox;
  }, [editorBox]);
  useEffect(() => {
    naturalBoxRef.current = naturalBox;
  }, [naturalBox]);

  const handlePointDrag = useCallback(
    (pointIndex: number, startEvent: React.MouseEvent<SVGCircleElement> | React.TouchEvent<SVGCircleElement>) => {
      startEvent.preventDefault();
      startEvent.stopPropagation();

      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const onMove = (moveEvent: MouseEvent | TouchEvent) => {
        const clientX = "touches" in moveEvent ? moveEvent.touches[0]?.clientX : moveEvent.clientX;
        const clientY = "touches" in moveEvent ? moveEvent.touches[0]?.clientY : moveEvent.clientY;

        if (clientX === undefined || clientY === undefined) return;

        const eb = editorBoxRef.current;
        const nb = naturalBoxRef.current;

        // Map screen -> editorBox units, accounting for the
        // preserveAspectRatio="xMidYMid meet" letterbox.
        const scale = Math.min(rect.width / eb.w, rect.height / eb.h);
        const renderedW = eb.w * scale;
        const renderedH = eb.h * scale;
        const offsetX = (rect.width - renderedW) / 2;
        const offsetY = (rect.height - renderedH) / 2;

        const unitX = eb.x + (clientX - rect.left - offsetX) / scale;
        const unitY = eb.y + (clientY - rect.top - offsetY) / scale;

        // Then map editorBox units -> fraction of the natural text box
        // (this is the 0..1 space mesh points actually live in).
        const relativeX = Math.min(Math.max((unitX - nb.x) / nb.w, -1.0), 2.0);
        const relativeY = Math.min(Math.max((unitY - nb.y) / nb.h, -5.0), 5.0);

        const newPoints = safeMesh.points.map((pt, idx) => {
          if (idx === pointIndex) {
            return { x: relativeX, y: relativeY };
          }
          return pt;
        });

        if (typeof onMeshChange === "function") {
          onMeshChange({ points: newPoints });
        }
      };

      const onEnd = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onEnd);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onEnd);
      window.addEventListener("touchmove", onMove);
      window.addEventListener("touchend", onEnd);
    },
    [safeMesh, onMeshChange]
  );

  const toXY = useCallback(
    (pt: Point2D) => ({ x: naturalBox.x + pt.x * naturalBox.w, y: naturalBox.y + pt.y * naturalBox.h }),
    [naturalBox]
  );

  // Outline follows the SAME Catmull-Rom curve used for the actual text
  // warp (evalMeshRow), sampled densely — this is what turns the visible
  // handles into a smooth flowing shape instead of a straight-edged polygon.
  const outlinePath = useMemo(() => {
    const topRow = safeMesh.points.slice(0, 5);
    const bottomRow = safeMesh.points.slice(5, 10);
    const STEPS = 24;

    const sample = (row: typeof topRow) =>
      Array.from({ length: STEPS + 1 }, (_, i) => toXY(evalMeshRow(row, i / STEPS)));

    const topCurve = sample(topRow);
    const bottomCurve = sample(bottomRow).reverse();

    const fmt = (p: { x: number; y: number }) => `${p.x} ${p.y}`;

    return [
      `M ${fmt(topCurve[0])}`,
      ...topCurve.slice(1).map((p) => `L ${fmt(p)}`),
      ...bottomCurve.map((p) => `L ${fmt(p)}`),
      "Z",
    ].join(" ");
  }, [safeMesh, toXY]);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onBack) onBack();
          }}
          style={{
            background: "none",
            border: "none",
            color: "#7d2ae8",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 13,
            padding: 0,
          }}
        >
          &lt; Warp editor
        </button>
        <span style={{ fontSize: 12, color: "#666" }}>Drag points to warp</span>
      </div>

      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          minHeight: 260,
          maxHeight: 340,
          background: "#f8f9fa",
          borderRadius: 12,
          position: "relative",
          overflow: "hidden",
          border: "1px solid #e0e0e0",
          boxSizing: "border-box",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`${editorBox.x} ${editorBox.y} ${editorBox.w} ${editorBox.h}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            touchAction: "none",
            userSelect: "none",
          }}
        >
          {canUseWarpedPath ? (
            <path d={pathData} fill={color} />
          ) : (
            <text
              x={naturalBox.x}
              y={naturalBox.y + naturalBox.h * 0.93}
              fill={color}
              fontFamily="Arial Black, Arial, sans-serif"
              fontSize={naturalBox.h * 1.35}
              fontWeight={900}
            >
              {text}
            </text>
          )}

          {/* Envelope outline — smooth curve, matches the reference shape */}
          <path
            d={outlinePath}
            fill="none"
            stroke="#0aa5ff"
            strokeWidth={Math.max(editorBox.w * 0.004, 1)}
          />

          {/* Interactive Handles */}
          {safeMesh.points.map((pt, idx) => {
            const p = toXY(pt);
            return (
              <circle
                key={`point-${idx}`}
                cx={p.x}
                cy={p.y}
                r={Math.max(editorBox.w * 0.025, 6)}
                fill="#ffffff"
                stroke="#0aa5ff"
                strokeWidth={Math.max(editorBox.w * 0.008, 3)}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => handlePointDrag(idx, e)}
                onTouchStart={(e) => handlePointDrag(idx, e)}
              />
            );
          })}

          {(isLoading || error) && (
            <text
              x={editorBox.x + editorBox.w / 2}
              y={editorBox.y + editorBox.h - editorBox.h * 0.08}
              fill={error ? "red" : "#666"}
              fontSize={Math.max(editorBox.h * 0.035, 11)}
              textAnchor="middle"
            >
              {error ? "Preview path error" : "Preparing editable path..."}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

export default CustomWarpEditor;