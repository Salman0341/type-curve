import React, {
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Button } from "@canva/app-ui-kit";
import { ArrowLeftIcon, PlusIcon, MinusIcon, ImageIcon } from "@canva/app-ui-kit/icons";
import { upload } from "@canva/asset";
import { addElementAtPoint, addElementAtCursor } from "@canva/design";
import type { CustomMeshState, CustomMeshPoint, Point2D } from "../../../utils/customWarpMath";
import {
  DEFAULT_CUSTOM_MESH,
  normalizeCustomMesh,
  sampleCurve,
  evaluateCurveAtX,
  rotateCustomMesh,
} from "../../../utils/customWarpMath";
import type { FillColor } from "../../../utils/fillColor";
import { DEFAULT_FILL_COLOR } from "../../../utils/fillColor";
import { SvgGradientDef, getSvgFillAttr } from "../../../utils/svgGradientDefs";
import type { StrokeConfig, ShadowConfig, DecorationConfig } from "../../../utils/buildWarpedImage";
import {
  scanImageContour,
  rescanCachedContourAtAngle,
  clearCachedImageContour,
  hasCachedImageContour,
} from "../../../utils/scanImageContour";
import { StickyPinned } from "./StickyPinned";

interface CustomWarpEditorProps {
  text?: string;
  pathData?: string;
  textBounds?: Box | null;
  isLoading?: boolean;
  error?: string | null;
  mesh?: CustomMeshState;
  color?: FillColor;
  startAngle?: number;
  strokeConfig?: StrokeConfig;
  shadowConfig?: ShadowConfig;
  decorationConfig?: DecorationConfig;
  onMeshChange?: (newMesh: CustomMeshState) => void;
  onResetShape?: () => void;
  onBack?: () => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EDITOR_GRADIENT_ID = "warp-editor-gradient";
const EDITOR_STROKE_GRADIENT_ID = "warp-editor-stroke-gradient";
const CANVA_BLUE = "#0e64d2";

function estimateTextBox(text: string | undefined): Box {
  const safeText = text?.trim() || "HELLO, WORLD!";
  const h = 58;
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

function padToEditorBox(natural: Box, points: CustomMeshPoint[], zoom: number): Box {
  let minYRel = 0, maxYRel = 1, minXRel = 0, maxXRel = 1;
  for (const p of points) {
    if (p.y < minYRel) minYRel = p.y;
    if (p.y > maxYRel) maxYRel = p.y;
    if (p.x < minXRel) minXRel = p.x;
    if (p.x > maxXRel) maxXRel = p.x;
  }

  const absMinX = natural.x + minXRel * natural.w;
  const absMaxX = natural.x + maxXRel * natural.w;
  const absMinY = natural.y + minYRel * natural.h;
  const absMaxY = natural.y + maxYRel * natural.h;

  const contentW = Math.max(absMaxX - absMinX, natural.w);
  const contentH = Math.max(absMaxY - absMinY, natural.h);

  const marginX = (contentW * 0.25) / zoom;
  const marginY = Math.max(contentH * 0.25, natural.h * 1.5) / zoom;

  return {
    x: absMinX - marginX,
    y: absMinY - marginY,
    w: contentW + marginX * 2,
    h: contentH + marginY * 2,
  };
}

export function CustomWarpEditor({
  text = "HELLO, WORLD!",
  pathData = "",
  textBounds,
  isLoading = false,
  error = null,
  mesh,
  color = DEFAULT_FILL_COLOR,
  startAngle = 0,
  strokeConfig,
  shadowConfig,
  decorationConfig,
  onMeshChange,
  onResetShape,
  onBack,
}: CustomWarpEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fallbackTextRef = useRef<SVGTextElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [screenScale, setScreenScale] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hoverAddInfo, setHoverAddInfo] = useState<{ curve: "top" | "bottom"; x: number; y: number; u: number; } | null>(null);

  const [localMesh, setLocalMesh] = useState<CustomMeshState>(() => normalizeCustomMesh(mesh));
  const baseMeshRef = useRef<CustomMeshState>(normalizeCustomMesh(mesh));
  const [bgImageOverlay, setBgImageOverlay] = useState<{ url: string; minCol: number; minRow: number; spanW: number; w: number; h: number } | null>(null);

  useEffect(() => {
    if (!isDragging) {
      setLocalMesh(normalizeCustomMesh(mesh));
      baseMeshRef.current = normalizeCustomMesh(mesh);
    }
  }, [mesh, isDragging]);

  const safeMesh = localMesh;
  const persistentPathRef = useRef<string>(pathData);
  if (pathData && !pathData.includes("NaN")) persistentPathRef.current = pathData;
  const activePathData = persistentPathRef.current || pathData;
  const canUseWarpedPath = Boolean(activePathData && !activePathData.includes("NaN"));

  const isIdentityMesh = useMemo(
    () =>
      startAngle === 0 &&
      JSON.stringify(safeMesh.topPoints) === JSON.stringify(DEFAULT_CUSTOM_MESH.topPoints) &&
      JSON.stringify(safeMesh.bottomPoints) === JSON.stringify(DEFAULT_CUSTOM_MESH.bottomPoints),
    [safeMesh, startAngle]
  );

  const [estimatedBox, setEstimatedBox] = useState<Box>(() => estimateTextBox(text));
  const [hasMeasuredFallback, setHasMeasuredFallback] = useState(false);

  // FIX: Added proper dependency array to prevent infinite loops
  useLayoutEffect(() => {
    if (hasUsableBounds(textBounds)) return;
    const node = fallbackTextRef.current;
    if (!node) return;
    let bbox: DOMRect;
    try { bbox = node.getBBox(); } catch { return; }
    if (!bbox.width || !bbox.height) return;

    setEstimatedBox((prev) => {
      const unchanged = Math.abs(prev.x - bbox.x) < 0.5 && Math.abs(prev.y - bbox.y) < 0.5 &&
                        Math.abs(prev.w - bbox.width) < 0.5 && Math.abs(prev.h - bbox.height) < 0.5;
      return unchanged ? prev : { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };
    });
    setHasMeasuredFallback(true);
  }, [text, textBounds, pathData]);

  const naturalBox: Box = hasUsableBounds(textBounds) ? textBounds : estimatedBox;
  const naturalBoxRef = useRef(naturalBox);
  useEffect(() => { naturalBoxRef.current = naturalBox; }, [naturalBox]);

  // Handle Rotation when startAngle changes from Style tab
  useEffect(() => {
    if (startAngle === 0 && !hasCachedImageContour()) {
      setLocalMesh(baseMeshRef.current);
      return;
    }

    const aspect = Math.max(0.1, naturalBoxRef.current.w / Math.max(1, naturalBoxRef.current.h));

    if (hasCachedImageContour()) {
      const extracted = rescanCachedContourAtAngle(aspect, startAngle);
      if (extracted) {
        const newMesh = normalizeCustomMesh(extracted);
        setLocalMesh(newMesh);
        if (extracted.preview) setBgImageOverlay(extracted.preview);
        if (typeof onMeshChange === "function") onMeshChange(newMesh);
        return;
      }
    }

    // Free rotate mode (No image uploaded)
    const rotated = rotateCustomMesh(baseMeshRef.current, startAngle, aspect);
    setLocalMesh(rotated);
    if (typeof onMeshChange === "function") onMeshChange(rotated);
  }, [startAngle]); // Dependencies restricted to startAngle

  const allCurrentPoints = useMemo(() => [...safeMesh.topPoints, ...safeMesh.bottomPoints], [safeMesh]);
  const editorBox = useMemo(() => padToEditorBox(naturalBox, allCurrentPoints, zoomLevel), [naturalBox, allCurrentPoints, zoomLevel]);

  const editorBoxRef = useRef(editorBox);
  useEffect(() => { editorBoxRef.current = editorBox; }, [editorBox]);

  const updateScreenScale = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width > 0 && editorBox.w > 0) setScreenScale(editorBox.w / rect.width);
  }, [editorBox.w]);

  useEffect(() => {
    updateScreenScale();
    window.addEventListener("resize", updateScreenScale);
    return () => window.removeEventListener("resize", updateScreenScale);
  }, [updateScreenScale]);

  const toAbsX = useCallback((rx: number) => naturalBox.x + rx * naturalBox.w, [naturalBox]);
  const toAbsY = useCallback((ry: number) => naturalBox.y + ry * naturalBox.h, [naturalBox]);

  const shadowHexColor = useMemo(() => {
    const c = shadowConfig?.color || DEFAULT_FILL_COLOR;
    return typeof c === "string" ? c : c.type === "solid" ? c.hexString : "#000000";
  }, [shadowConfig]);

  const decorHexColor = useMemo(() => {
    const c = decorationConfig?.color || DEFAULT_FILL_COLOR;
    return typeof c === "string" ? c : c.type === "solid" ? c.hexString : "#b0b8c1";
  }, [decorationConfig]);

  const shadowDx = useMemo(() => {
    const angle = shadowConfig?.angle ?? 45;
    const offset = shadowConfig?.offset ?? 4;
    return offset * Math.cos((angle * Math.PI) / 180);
  }, [shadowConfig]);

  const shadowDy = useMemo(() => {
    const angle = shadowConfig?.angle ?? 45;
    const offset = shadowConfig?.offset ?? 4;
    return offset * Math.sin((angle * Math.PI) / 180);
  }, [shadowConfig]);

  const previewCenter = useMemo(() => ({ cx: naturalBox.x + naturalBox.w / 2, cy: naturalBox.y + naturalBox.h / 2 }), [naturalBox]);

  const shadowType = shadowConfig?.type || "none";
  const decorationType = decorationConfig?.type || "none";
  const strokeEnabled = strokeConfig?.enabled || false;

  const rafId = useRef<number | null>(null);
  const pendingMeshRef = useRef<CustomMeshState | null>(null);

  const scheduleParentUpdate = useCallback((newMesh: CustomMeshState) => {
    pendingMeshRef.current = newMesh;
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        if (pendingMeshRef.current && typeof onMeshChange === "function") {
          onMeshChange(pendingMeshRef.current);
        }
        rafId.current = null;
      });
    }
  }, [onMeshChange]);

  const handlePointDrag = useCallback((curveType: "top" | "bottom", pointIndex: number, startEvent: React.MouseEvent | React.TouchEvent) => {
    startEvent.preventDefault(); startEvent.stopPropagation();
    if (!svgRef.current) return;
    setIsDragging(true); setHoverAddInfo(null);

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = "touches" in moveEvent ? moveEvent.touches[0]?.clientX : moveEvent.clientX;
      const clientY = "touches" in moveEvent ? moveEvent.touches[0]?.clientY : moveEvent.clientY;
      if (clientX === undefined || clientY === undefined || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const eb = editorBoxRef.current; const nb = naturalBoxRef.current;
      const scale = Math.min(rect.width / eb.w, rect.height / eb.h);
      const renderedW = eb.w * scale; const renderedH = eb.h * scale;
      const offsetX = (rect.width - renderedW) / 2; const offsetY = (rect.height - renderedH) / 2;

      const unitX = eb.x + (clientX - rect.left - offsetX) / scale;
      const unitY = eb.y + (clientY - rect.top - offsetY) / scale;

      const relativeX = Math.min(Math.max((unitX - nb.x) / nb.w, -5.0), 5.0);
      const relativeY = Math.min(Math.max((unitY - nb.y) / nb.h, -15.0), 15.0);

      setLocalMesh((prev) => {
        const targetList = curveType === "top" ? [...prev.topPoints] : [...prev.bottomPoints];
        targetList[pointIndex] = { ...targetList[pointIndex], x: relativeX, y: relativeY };

        const nextMesh = normalizeCustomMesh({
          topPoints: curveType === "top" ? targetList : prev.topPoints,
          bottomPoints: curveType === "bottom" ? targetList : prev.bottomPoints,
        });

        // Set base mesh too if we drag, so rotations apply to dragged points
        baseMeshRef.current = nextMesh;
        scheduleParentUpdate(nextMesh);
        return nextMesh;
      });
    };

    const onEnd = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove); window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };

    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove); window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onEnd);
  }, [scheduleParentUpdate]);

  const handleAddPointClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!hoverAddInfo) return;

    const { curve, u } = hoverAddInfo;
    const targetList = curve === "top" ? safeMesh.topPoints : safeMesh.bottomPoints;
    const ptOnCurve = evaluateCurveAtX(targetList, u);

    const newPoint: CustomMeshPoint = {
      id: `${curve[0]}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      x: ptOnCurve.x,
      y: ptOnCurve.y,
    };

    const insertIndex = Math.max(1, Math.min(Math.floor(u * (targetList.length - 1)) + 1, targetList.length - 1));
    const nextList = [...targetList];
    nextList.splice(insertIndex, 0, newPoint);

    const nextMesh = normalizeCustomMesh({
      topPoints: curve === "top" ? nextList : safeMesh.topPoints,
      bottomPoints: curve === "bottom" ? nextList : safeMesh.bottomPoints,
    });

    baseMeshRef.current = nextMesh;
    setHoverAddInfo(null); setLocalMesh(nextMesh);
    if (typeof onMeshChange === "function") onMeshChange(nextMesh);
  }, [hoverAddInfo, safeMesh, onMeshChange]);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true); setScanError(null);
    setScanMessage("Scanning shape & adding to design...");

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject; reader.readAsDataURL(file);
      });

      try {
        const asset = await upload({
          type: "image", mimeType: (file.type as "image/png" | "image/jpeg") || "image/png",
          url: dataUrl, thumbnailUrl: dataUrl,
        });
        if (typeof addElementAtPoint === "function") {
          await addElementAtPoint({ type: "image", ref: asset.ref });
        } else if (typeof addElementAtCursor === "function") {
          await addElementAtCursor({ type: "image", ref: asset.ref });
        }
      } catch (canvaErr) {
        console.warn("Canva canvas insertion failed:", canvaErr);
      }

      const textAspectRatio = Math.max(0.1, naturalBox.w / Math.max(1, naturalBox.h));
      const extracted = await scanImageContour(file, textAspectRatio, startAngle);
      const newMesh = normalizeCustomMesh(extracted);

      if (extracted.preview) {
        setBgImageOverlay(extracted.preview);
      }

      baseMeshRef.current = newMesh;
      setLocalMesh(newMesh);
      if (typeof onMeshChange === "function") onMeshChange(newMesh);
      
      setScanMessage("Shape matched! Adjust 360° slider in Style tab to change position.");
      setTimeout(() => setScanMessage(null), 3000);
    } catch (err: any) {
      setScanError(err?.message || "Failed to scan image.");
      setScanMessage(null);
      setBgImageOverlay(null);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const eb = editorBoxRef.current; const nb = naturalBoxRef.current;
    const scale = Math.min(rect.width / eb.w, rect.height / eb.h);
    const renderedW = eb.w * scale; const renderedH = eb.h * scale;
    const offsetX = (rect.width - renderedW) / 2; const offsetY = (rect.height - renderedH) / 2;

    const unitX = eb.x + (e.clientX - rect.left - offsetX) / scale;
    const unitY = eb.y + (e.clientY - rect.top - offsetY) / scale;

    if (hoverAddInfo) {
      const badgeCenterY = hoverAddInfo.y - 24 * screenScale;
      if (Math.abs(unitX - hoverAddInfo.x) < 55 * screenScale && Math.abs(unitY - badgeCenterY) < 30 * screenScale) return;
    }

    const allPoints = [...safeMesh.topPoints, ...safeMesh.bottomPoints];
    for (const pt of allPoints) {
      const px = toAbsX(pt.x); const py = toAbsY(pt.y);
      if (Math.hypot(unitX - px, unitY - py) / screenScale < 28) {
        setHoverAddInfo(null); return;
      }
    }

    const STEPS = 40; let closestTopDist = Infinity, bestTopU = 0, bestTopPt: Point2D = { x: 0, y: 0 };
    for (let s = 1; s < STEPS; s++) {
      const u = s / STEPS;
      const pt = evaluateCurveAtX(safeMesh.topPoints, u);
      const d = Math.hypot(unitX - toAbsX(pt.x), unitY - toAbsY(pt.y)) / screenScale;
      if (d < closestTopDist) { closestTopDist = d; bestTopU = u; bestTopPt = pt; }
    }

    let closestBottomDist = Infinity, bestBottomU = 0, bestBottomPt: Point2D = { x: 0, y: 0 };
    for (let s = 1; s < STEPS; s++) {
      const u = s / STEPS;
      const pt = evaluateCurveAtX(safeMesh.bottomPoints, u);
      const d = Math.hypot(unitX - toAbsX(pt.x), unitY - toAbsY(pt.y)) / screenScale;
      if (d < closestBottomDist) { closestBottomDist = d; bestBottomU = u; bestBottomPt = pt; }
    }

    const THRESHOLD = 22;
    if (closestTopDist < THRESHOLD && closestTopDist <= closestBottomDist) {
      setHoverAddInfo({ curve: "top", x: toAbsX(bestTopPt.x), y: toAbsY(bestTopPt.y), u: bestTopU });
    } else if (closestBottomDist < THRESHOLD) {
      setHoverAddInfo({ curve: "bottom", x: toAbsX(bestBottomPt.x), y: toAbsY(bestBottomPt.y), u: bestBottomU });
    } else {
      setHoverAddInfo(null);
    }
  };

  const topSpline = useMemo(() => sampleCurve(safeMesh.topPoints, 40), [safeMesh.topPoints]);
  const bottomSpline = useMemo(() => sampleCurve(safeMesh.bottomPoints, 40), [safeMesh.bottomPoints]);
  const fullEnclosingD = useMemo(() => {
    if (topSpline.length === 0 || bottomSpline.length === 0) return "";
    return `M ${toAbsX(topSpline[0].x)} ${toAbsY(topSpline[0].y)} ` +
      topSpline.slice(1).map((p) => `L ${toAbsX(p.x)} ${toAbsY(p.y)}`).join(" ") + " " +
      [...bottomSpline].reverse().map((p) => `L ${toAbsX(p.x)} ${toAbsY(p.y)}`).join(" ") + " Z";
  }, [topSpline, bottomSpline, toAbsX, toAbsY]);

  const renderFallbackText = (extraProps?: React.SVGProps<SVGTextElement>) => (
    <text
      x={naturalBox.x} y={naturalBox.y + naturalBox.h * 0.93}
      fontFamily="Arial Black, Arial, sans-serif" fontSize={naturalBox.h * 1.35} fontWeight={900}
      textLength={naturalBox.w} lengthAdjust="spacingAndGlyphs" {...extraProps}
    >
      {text}
    </text>
  );

  const handleR = 7.5 * screenScale;
  const handleStroke = 2.2 * screenScale;
  const dashWidth = 1.6 * screenScale;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, boxSizing: "border-box" }}>
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={handleImageFileChange} />
      <div style={{ background: "#ffffff", paddingBottom: 4, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Button icon={ArrowLeftIcon} onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onBack) onBack(); }} style={{ background: "none", border: "none", color: "#7d2ae8", fontWeight: 600, cursor: "pointer", fontSize: 13, padding: 0 }}>Edit shape</Button>
          <span style={{ fontSize: 12, color: "#666" }}>Drag points to warp</span>
        </div>
        
        <StickyPinned>
          <div style={{ width: "100%", aspectRatio: "1 / 1", minHeight: 260, maxHeight: 340, background: "#f8f9fa", borderRadius: 12, position: "relative", overflow: "hidden", border: "1px solid #e1e3e5", boxSizing: "border-box" }}>
            <svg ref={svgRef} viewBox={`${editorBox.x} ${editorBox.y} ${editorBox.w} ${editorBox.h}`} preserveAspectRatio="xMidYMid meet" onMouseMove={handleSvgMouseMove} onMouseLeave={() => setHoverAddInfo(null)} style={{ width: "100%", height: "100%", display: "block", touchAction: "none", userSelect: "none" }}>
              <defs>
                <SvgGradientDef color={color} id={EDITOR_GRADIENT_ID} />
                {strokeConfig?.color && <SvgGradientDef color={strokeConfig.color} id={EDITOR_STROKE_GRADIENT_ID} />}
                {shadowType === "drop" && <filter id="editor-drop-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx={shadowDx} dy={shadowDy} stdDeviation={(shadowConfig?.blur ?? 12) / 2} floodColor={shadowHexColor} floodOpacity="0.8" /></filter>}
                {decorationType === "lines" && <pattern id="editor-decor-lines" width="20" height={Math.max(1, (decorationConfig?.weight ?? 5) + (decorationConfig?.distance ?? 50))} patternUnits="userSpaceOnUse" patternTransform={`rotate(${(decorationConfig?.angle ?? 90) - 90})`}><rect x="0" y="0" width="20" height={decorationConfig?.weight ?? 5} fill={decorHexColor} opacity={(decorationConfig?.opacity ?? 100) / 100} /></pattern>}
                {decorationType === "stripes_cut" && <pattern id="editor-decor-stripes" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect x="0" y="0" width="4" height={decorationConfig?.weight ?? 4} fill={decorHexColor} opacity={(decorationConfig?.opacity ?? 100) / 100} /></pattern>}
                {decorationType === "color_cut" && <clipPath id="editor-decor-cut">{canUseWarpedPath ? <path d={activePathData} /> : renderFallbackText()}</clipPath>}
                <filter id="solid-handle-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.32" /></filter>
              </defs>

              {bgImageOverlay && bgImageOverlay.url && (
                <image
                  href={bgImageOverlay.url}
                  x={naturalBox.x - (bgImageOverlay.minCol / bgImageOverlay.spanW) * naturalBox.w}
                  y={naturalBox.y - (bgImageOverlay.minRow / bgImageOverlay.spanW) * naturalBox.w}
                  width={(bgImageOverlay.w / bgImageOverlay.spanW) * naturalBox.w}
                  height={(bgImageOverlay.h / bgImageOverlay.spanW) * naturalBox.w}
                  preserveAspectRatio="none"
                  opacity={0.25}
                  pointerEvents="none"
                />
              )}

              {canUseWarpedPath ? (
                <>
                  {shadowType === "line" && <path d={activePathData} fill="none" stroke={shadowHexColor} strokeWidth={shadowConfig?.width ?? 3} strokeLinejoin="round" strokeLinecap="round" transform={`translate(${shadowDx}, ${shadowDy})`} />}
                  {shadowType === "block" && (() => { const stepDist = 1.5; const totalSteps = Math.max(1, Math.ceil((shadowConfig?.offset ?? 4) / stepDist)); const isPerspective = shadowConfig?.blockStyle === "perspective"; const layers = []; for (let i = totalSteps; i >= 1; i--) { const ratio = i / totalSteps; const sx = shadowDx * ratio; const sy = shadowDy * ratio; if (isPerspective) { layers.push(<path key={`eshb-${i}`} d={activePathData} fill={shadowHexColor} stroke={shadowHexColor} strokeWidth={1.5} strokeLinejoin="round" transform={`translate(${previewCenter.cx}, ${previewCenter.cy}) translate(${sx}, ${sy}) scale(${1 - ratio * 0.12}) translate(${-previewCenter.cx}, ${-previewCenter.cy})`} />); } else { layers.push(<path key={`eshb-${i}`} d={activePathData} fill={shadowHexColor} stroke={shadowHexColor} strokeWidth={1.5} strokeLinejoin="round" transform={`translate(${sx}, ${sy})`} />); } } return layers; })()}
                  {strokeEnabled && strokeConfig && <path d={activePathData} fill="none" stroke={getSvgFillAttr(strokeConfig.color, EDITOR_STROKE_GRADIENT_ID)} strokeWidth={strokeConfig.width} strokeLinejoin="round" />}
                  <path d={activePathData} fill={getSvgFillAttr(color, EDITOR_GRADIENT_ID)} filter={shadowType === "drop" ? "url(#editor-drop-shadow)" : undefined} />
                  {decorationType === "lines" && <path d={activePathData} fill="url(#editor-decor-lines)" pointerEvents="none" />}
                  {decorationType === "stripes_cut" && <path d={activePathData} fill="url(#editor-decor-stripes)" pointerEvents="none" />}
                  {decorationType === "color_cut" && <rect x={editorBox.x} y={naturalBox.y + naturalBox.h * 0.52} width={editorBox.w} height={naturalBox.h * 0.38} fill={decorHexColor} opacity={(decorationConfig?.opacity ?? 100) / 100} clipPath="url(#editor-decor-cut)" pointerEvents="none" />}
                  {decorationType === "inner_outline" && <path d={activePathData} fill="none" stroke={decorHexColor} strokeWidth={Math.max(1, decorationConfig?.weight ?? 5)} strokeOpacity={(decorationConfig?.opacity ?? 100) / 100} strokeLinejoin="round" pointerEvents="none" />}
                </>
              ) : !isLoading ? renderFallbackText({ ref: fallbackTextRef, fill: getSvgFillAttr(color, EDITOR_GRADIENT_ID) }) : null}

              <path d={fullEnclosingD} fill="none" stroke={CANVA_BLUE} strokeWidth={dashWidth} strokeDasharray={`${5 * screenScale} ${5 * screenScale}`} pointerEvents="none" />

              {hoverAddInfo && !isDragging && (
                <g transform={`translate(${hoverAddInfo.x}, ${hoverAddInfo.y})`} style={{ cursor: "pointer" }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={handleAddPointClick}>
                  <rect x={-48 * screenScale} y={-36 * screenScale} width={96 * screenScale} height={44 * screenScale} fill="transparent" />
                  <circle cx="0" cy="0" r={4.5 * screenScale} fill={CANVA_BLUE} pointerEvents="none" />
                  <g transform={`translate(0, ${-22 * screenScale}) scale(${screenScale})`} pointerEvents="none">
                    <rect x="-42" y="-12" width="84" height="24" rx="12" fill="#0e1318" stroke="#ffffff" strokeWidth="1.2" filter="drop-shadow(0 2px 5px rgba(0,0,0,0.28))" />
                    <text x="0" y="4" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="Canva Sans, system-ui, -apple-system, sans-serif">+ Add a point</text>
                  </g>
                </g>
              )}

              {[
                ...safeMesh.topPoints.map((p, idx) => ({ ...p, curve: "top" as const, index: idx })),
                ...safeMesh.bottomPoints.map((p, idx) => ({ ...p, curve: "bottom" as const, index: idx })),
              ].map((pt) => {
                const cx = toAbsX(pt.x);
                const cy = toAbsY(pt.y);

                return (
                  <g key={pt.id} style={{ cursor: isDragging ? "grabbing" : "grab" }}>
                    <circle cx={cx} cy={cy} r={16 * screenScale} fill="transparent" onMouseDown={(e) => handlePointDrag(pt.curve, pt.index, e)} onTouchStart={(e) => handlePointDrag(pt.curve, pt.index, e)} />
                    <circle cx={cx} cy={cy} r={handleR} fill={CANVA_BLUE} stroke="#ffffff" strokeWidth={handleStroke} filter="url(#solid-handle-shadow)" pointerEvents="none" />
                  </g>
                );
              })}
            </svg>
            <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", alignItems: "center", gap: 4, background: "#ffffff", padding: "2px 8px", borderRadius: 8, border: "1px solid #e1e3e5", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
              <button type="button" onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", color: "#0e1318" }} title="Zoom out"><MinusIcon /></button>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0e1318", minWidth: 34, textAlign: "center" }}>{Math.round(zoomLevel * 100)}%</span>
              <button type="button" onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.2))} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", color: "#0e1318" }} title="Zoom in"><PlusIcon /></button>
            </div>
          </div>
        </StickyPinned>
      </div>

      {scanMessage && <span style={{ fontSize: 12, color: "#0e64d2", fontWeight: 600 }}>{scanMessage}</span>}
      {scanError && <span style={{ fontSize: 12, color: "#e0203a", fontWeight: 500 }}>{scanError}</span>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Button variant="primary" icon={ImageIcon} onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
          {isScanning ? "Scanning shape & adding to design..." : "Fit shape from image (PNG)"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            clearCachedImageContour();
            setBgImageOverlay(null);
            baseMeshRef.current = DEFAULT_CUSTOM_MESH;
            setLocalMesh(DEFAULT_CUSTOM_MESH);
            if (typeof onResetShape === "function") {
              onResetShape();
            } else if (typeof onMeshChange === "function") {
              onMeshChange(DEFAULT_CUSTOM_MESH);
            }
          }}
          disabled={isIdentityMesh && !bgImageOverlay}
        >
          Reset Shape
        </Button>
      </div>
    </div>
  );
}

export default CustomWarpEditor;