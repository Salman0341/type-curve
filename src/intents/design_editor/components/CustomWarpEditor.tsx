import React, { useRef, useCallback } from "react";
import { EnvelopeMeshState, DEFAULT_ENVELOPE_MESH, Point2D } from "../../../utils/customWarpMath";

interface CustomWarpEditorProps {
  text?: string;
  pathData?: string;
  viewBox?: string;
  mesh?: EnvelopeMeshState;
  color?: string;
  onMeshChange?: (newMesh: EnvelopeMeshState) => void;
  onBack?: () => void;
}

export function CustomWarpEditor({
  pathData = "",
  viewBox = "0 0 320 180",
  mesh = DEFAULT_ENVELOPE_MESH,
  color = "#000000",
  onMeshChange,
  onBack,
}: CustomWarpEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const vbParts = React.useMemo(() => {
    const parts = (viewBox || "0 0 320 180").split(" ").map((v) => Number(v) || 0);
    return { x: parts[0] ?? 0, y: parts[1] ?? 0, w: parts[2] || 320, h: parts[3] || 180 };
  }, [viewBox]);

  const handleHandleDrag = useCallback(
    (
      section: "top" | "bottom" | "left" | "right",
      key: "p0" | "c1" | "c2" | "p1",
      startEvent: React.MouseEvent | React.TouchEvent
    ) => {
      startEvent.preventDefault();
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();

      const onMove = (moveEvent: MouseEvent | TouchEvent) => {
        const clientX = "touches" in moveEvent ? moveEvent.touches[0]?.clientX : moveEvent.clientX;
        const clientY = "touches" in moveEvent ? moveEvent.touches[0]?.clientY : moveEvent.clientY;
        if (clientX === undefined || clientY === undefined) return;

        const relX = (clientX - rect.left) / rect.width;
        const relY = (clientY - rect.top) / rect.height;

        const updatedMesh: EnvelopeMeshState = JSON.parse(JSON.stringify(mesh));
        updatedMesh[section][key] = { x: relX, y: relY };

        if (onMeshChange) {
          onMeshChange(updatedMesh);
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
    [mesh, onMeshChange]
  );

  const toSvgX = (p: Point2D) => vbParts.x + p.x * vbParts.w;
  const toSvgY = (p: Point2D) => vbParts.y + p.y * vbParts.h;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: "none", border: "none", color: "#0084ff", fontWeight: 600, cursor: "pointer" }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 12, color: "#666" }}>Drag handles to curve text</span>
      </div>

      <div style={{ width: "100%", height: 260, background: "#f0f0f0", borderRadius: 8, position: "relative" }}>
        <svg ref={svgRef} viewBox={`${vbParts.x} ${vbParts.y} ${vbParts.w} ${vbParts.h}`} style={{ width: "100%", height: "100%" }}>
          {/* Warped Text Path */}
          {pathData && <path d={pathData} fill={color} />}

          {/* Blue Envelope Boundary Lines */}
          <path
            d={`M ${toSvgX(mesh.top.p0)} ${toSvgY(mesh.top.p0)} C ${toSvgX(mesh.top.c1)} ${toSvgY(mesh.top.c1)}, ${toSvgX(
              mesh.top.c2
            )} ${toSvgY(mesh.top.c2)}, ${toSvgX(mesh.top.p1)} ${toSvgY(mesh.top.p1)}
               C ${toSvgX(mesh.right.c1)} ${toSvgY(mesh.right.c1)}, ${toSvgX(mesh.right.c2)} ${toSvgY(
              mesh.right.c2
            )}, ${toSvgX(mesh.bottom.p1)} ${toSvgY(mesh.bottom.p1)}
               C ${toSvgX(mesh.bottom.c2)} ${toSvgY(mesh.bottom.c2)}, ${toSvgX(mesh.bottom.c1)} ${toSvgY(
              mesh.bottom.c1
            )}, ${toSvgX(mesh.bottom.p0)} ${toSvgY(mesh.bottom.p0)}
               C ${toSvgX(mesh.left.c2)} ${toSvgY(mesh.left.c2)}, ${toSvgX(mesh.left.c1)} ${toSvgY(
              mesh.left.c1
            )}, ${toSvgX(mesh.top.p0)} ${toSvgY(mesh.top.p0)}`}
            fill="none"
            stroke="#0084ff"
            strokeWidth={2}
          />

          {/* Top Handle Tangent Line */}
          <line x1={toSvgX(mesh.top.c1)} y1={toSvgY(mesh.top.c1)} x2={toSvgX(mesh.top.c2)} y2={toSvgY(mesh.top.c2)} stroke="#0084ff" strokeWidth={1.5} />
          {/* Bottom Handle Tangent Line */}
          <line x1={toSvgX(mesh.bottom.c1)} y1={toSvgY(mesh.bottom.c1)} x2={toSvgX(mesh.bottom.c2)} y2={toSvgY(mesh.bottom.c2)} stroke="#0084ff" strokeWidth={1.5} />

          {/* Interactive Handle Dots */}
          {[
            { sec: "top" as const, key: "c1" as const, pt: mesh.top.c1 },
            { sec: "top" as const, key: "c2" as const, pt: mesh.top.c2 },
            { sec: "bottom" as const, key: "c1" as const, pt: mesh.bottom.c1 },
            { sec: "bottom" as const, key: "c2" as const, pt: mesh.bottom.c2 },
            { sec: "left" as const, key: "c1" as const, pt: mesh.left.c1 },
            { sec: "right" as const, key: "c1" as const, pt: mesh.right.c1 },
          ].map((item, i) => (
            <circle
              key={i}
              cx={toSvgX(item.pt)}
              cy={toSvgY(item.pt)}
              r={6}
              fill="#ffffff"
              stroke="#0084ff"
              strokeWidth={2.5}
              style={{ cursor: "pointer" }}
              onMouseDown={(e) => handleHandleDrag(item.sec, item.key, e)}
              onTouchStart={(e) => handleHandleDrag(item.sec, item.key, e)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

export default CustomWarpEditor;