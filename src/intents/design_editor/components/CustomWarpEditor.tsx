import React, { useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {Button} from '@canva/app-ui-kit';
import { ArrowLeftIcon } from "@canva/app-ui-kit/icons";
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

// 3 anchors per row (left, center, right — all ON the curve, filled) +
// 2 handles per row (OFF the curve, hollow, one per quadratic segment).
// This matches the Canva reference: 6 filled anchors + 4 hollow handles.
const ANCHOR_INDICES = new Set([0, 2, 4, 5, 7, 9]);
const HANDLE_INDICES = new Set([1, 3, 6, 8]);
// Handle lines only fan out from each row's CENTER anchor — not from the
// outer left/right anchors — matching the reference (clean lines going
// up from the curve's peak/dip to its tension handles, no crisscross).
const HANDLE_LINKS: Array<[number, number]> = [
  [2, 1], // top-center anchor -> its left handle
  [2, 3], // top-center anchor -> its right handle
  [7, 6], // bottom-center anchor -> its left handle
  [7, 8], // bottom-center anchor -> its right handle
];

function estimateTextBox(text: string | undefined): Box {
  const safeText = text?.trim() || "HELLO, WORLD!";
  const h = 58;
  // Rough starting guess only, used for exactly one render before the
  // measurement effect below corrects it to the real rendered size —
  // it never has to be pixel-accurate.
  const fontSize = h * 1.35;
  const w = Math.max(safeText.length * fontSize * 0.68, 160);
  return { x: 0, y: -54, w, h };
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

function padToEditorBox(natural: Box): Box {
  // The SVG already has preserveAspectRatio="xMidYMid meet" inside a
  // square container, so the browser letterboxes any aspect ratio on
  // its own — we don't need to force this box towards square. Just pad
  // the real box, with enough vertical room for a visible arc.
  const marginX = natural.w * 0.35;
  const marginY = Math.max(natural.h * 1.5, natural.w * 0.12);
  return {
    x: natural.x - marginX,
    y: natural.y - marginY,
    w: natural.w + marginX * 2,
    h: natural.h + marginY * 2,
  };
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
  const fallbackTextRef = useRef<SVGTextElement | null>(null);

  const safeMesh = useMemo(() => {
    return normalizeCustomMesh(mesh);
  }, [mesh]);

  const isIdentityMesh = useMemo(
    () => JSON.stringify(safeMesh.points) === JSON.stringify(DEFAULT_CUSTOM_MESH.points),
    [safeMesh]
  );

  const canUseWarpedPath =
    hasUsableBounds(textBounds) && pathData && !pathData.includes("NaN");

  const [naturalBox, setNaturalBox] = useState<Box>(() =>
    hasUsableBounds(textBounds) ? textBounds : estimateTextBox(text)
  );

  // Real bounds arrived (font finished loading) — use them directly, no
  // estimating/measuring needed.
  useEffect(() => {
    if (hasUsableBounds(textBounds)) {
      setNaturalBox(textBounds);
    }
  }, [textBounds]);

  // While we don't have real bounds yet, render the fallback <text> with
  // whatever naturalBox we currently have, then measure its ACTUAL
  // rendered bounding box and correct naturalBox to match exactly. Runs
  // as a layout effect (before the browser paints) so there's no visible
  // flash, and re-runs every render until the measured size stops
  // changing — reliably converges to the true size instead of relying on
  // a fixed guess formula.
  useLayoutEffect(() => {
    if (hasUsableBounds(textBounds)) return;
    const node = fallbackTextRef.current;
    if (!node) return;

    let bbox: DOMRect;
    try {
      bbox = node.getBBox();
    } catch {
      return;
    }
    if (!bbox.width || !bbox.height) return;

    setNaturalBox((prev) => {
      const unchanged =
        Math.abs(prev.x - bbox.x) < 0.5 &&
        Math.abs(prev.y - bbox.y) < 0.5 &&
        Math.abs(prev.w - bbox.width) < 0.5 &&
        Math.abs(prev.h - bbox.height) < 0.5;
      return unchanged ? prev : { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };
    });
  });

  // Reset function jo mesh ko default par set karega
  const handleResetShape = () => {
    if (typeof onMeshChange === "function") {
      onMeshChange(DEFAULT_CUSTOM_MESH);
    }
  };

  const editorBox = useMemo(() => padToEditorBox(naturalBox), [naturalBox]);

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

        const scale = Math.min(rect.width / eb.w, rect.height / eb.h);
        const renderedW = eb.w * scale;
        const renderedH = eb.h * scale;
        const offsetX = (rect.width - renderedW) / 2;
        const offsetY = (rect.height - renderedH) / 2;

        const unitX = eb.x + (clientX - rect.left - offsetX) / scale;
        const unitY = eb.y + (clientY - rect.top - offsetY) / scale;

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
        <Button
          icon={ArrowLeftIcon }
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
        Warp Editor
        </Button>
        <span style={{ fontSize: 12, color: "#666" }}>Drag points to warp</span>
      </div>

      {/* Editor SVG Canvas */}
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
              ref={fallbackTextRef}
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

          {/* Envelope outline */}
          <path
            d={outlinePath}
            fill="none"
            stroke="#0aa5ff"
            strokeWidth={Math.max(editorBox.w * 0.004, 1)}
          />

          {/* Anchor <-> handle connector lines */}
          {HANDLE_LINKS.map(([a, b]) => {
            const pa = toXY(safeMesh.points[a]);
            const pb = toXY(safeMesh.points[b]);
            return (
              <line
                key={`link-${a}-${b}`}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="#0aa5ff"
                strokeWidth={Math.max(editorBox.w * 0.003, 1)}
                strokeDasharray="4 3"
              />
            );
          })}

          {/* Interactive Handles — anchors (filled) + handles (hollow) */}
          {safeMesh.points.map((pt, idx) => {
            const isAnchor = ANCHOR_INDICES.has(idx);
            const isHandle = HANDLE_INDICES.has(idx);
            if (!isAnchor && !isHandle) return null;

            const p = toXY(pt);
            const r = isAnchor
              ? Math.max(editorBox.w * 0.032, 8)
              : Math.max(editorBox.w * 0.022, 5);

            return (
              <circle
                key={`point-${idx}`}
                cx={p.x}
                cy={p.y}
                r={r}
                fill={isAnchor ? "#0aa5ff" : "#ffffff"}
                stroke={isAnchor ? "#ffffff" : "#0aa5ff"}
                strokeWidth={Math.max(editorBox.w * (isAnchor ? 0.006 : 0.008), isAnchor ? 2 : 3)}
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

      {/* Full-width Stretched "Reset Shape" Button */}
      <button
        type="button"
        onClick={handleResetShape}
        disabled={isIdentityMesh}
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          padding: "10px 14px",
          borderRadius: "8px",
          background: "#f0f0f0",
          color: isIdentityMesh ? "#aaa" : "#333",
          border: "1px solid #ccc",
          fontWeight: 600,
          fontSize: "13px",
          cursor: isIdentityMesh ? "not-allowed" : "pointer",
          opacity: isIdentityMesh ? 0.6 : 1,
          transition: "all 0.2s ease",
        }}
      >
        Reset Shape
      </button>
    </div>
  );
}

export default CustomWarpEditor;