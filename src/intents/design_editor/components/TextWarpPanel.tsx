import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MultilineInput,
  Button,
  SegmentedControl,
  FormField,
  Select,
  Slider,
  Switch,
} from "@canva/app-ui-kit";
import { OptionCarousel } from "./OptionCarousel";
import { CustomWarpEditor } from "./CustomWarpEditor";
import { GradientColorField } from "./GradientColorField";
import { StickyPinned } from "./StickyPinned";
import { useSvgTextWarp, WarpEffect } from "../hooks/useSvgTextWarp";
import { useLoadedFont } from "../hooks/useLoadedFont";
import { useAddTextWarpToDesign } from "../hooks/useAddTextWarpToDesign";
import { useEditableTextWarp } from "../hooks/useEditableTextWarp";
import {
  DEFAULT_CUSTOM_MESH,
  CustomMeshState,
  normalizeCustomMesh,
  rotateCustomMesh,
} from "../../../utils/customWarpMath";
import {
  hasCachedImageContour,
  rescanCachedContourAtAngle,
  clearCachedImageContour,
} from "../../../utils/scanImageContour";
import { computeWarpedText } from "../../../utils/warpTextCompute";
import type { FillColor } from "../../../utils/fillColor";
import { DEFAULT_FILL_COLOR } from "../../../utils/fillColor";
import { SvgGradientDef, getSvgFillAttr } from "../../../utils/svgGradientDefs";

type PanelTab = "general" | "style";
type AddMode = "editable" | "image";

const FONT_FAMILY_OPTIONS = [
  { value: "roboto", label: "Roboto (Sans-Serif)", url: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf" },
  { value: "open-sans", label: "Open Sans", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/opensans/OpenSans%5Bwdth%2Cwght%5D.ttf" },
  { value: "poppins-medium", label: "Poppins", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Medium.ttf" },
  { value: "lato", label: "Lato", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lato/Lato-Regular.ttf" },
  { value: "righteous", label: "Righteous", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/righteous/Righteous-Regular.ttf" },
  { value: "abril-fatface", label: "Abril Fatface", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/abrilfatface/AbrilFatface-Regular.ttf" },
  { value: "shadows-into-light", label: "Shadows Into Light", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/shadowsintolight/ShadowsIntoLight.ttf" },
  { value: "permanent-marker", label: "Permanent Marker", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/apache/permanentmarker/PermanentMarker-Regular.ttf" },
  { value: "satisfy", label: "Satisfy", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/apache/satisfy/Satisfy-Regular.ttf" },
];

interface WarpOption { id: string; name: string; effect: WarpEffect; isCustom?: boolean; }
const WARP_OPTIONS: WarpOption[] = [
  { id: "bulge", name: "Bulge Circle", effect: "bulge" },
  { id: "rise-decrease", name: "Perspective Shrink", effect: "rise-decrease" },
  { id: "rise-increase", name: "Perspective Grow", effect: "rise-increase" },
  { id: "custom", name: "Custom Mesh", effect: "custom", isCustom: true },
];

interface ShadowOption { id: string; name: string; }
const SHADOW_OPTIONS: ShadowOption[] = [
  { id: "none", name: "None" }, { id: "drop", name: "Drop" }, { id: "line", name: "Line" }, { id: "block", name: "Block" },
];

interface DecorationOption { id: string; name: string; }
const DECORATION_OPTIONS: DecorationOption[] = [
  { id: "none", name: "None" }, { id: "lines", name: "Lines" }, { id: "color_cut", name: "Color cut" },
  { id: "stripes_cut", name: "Stripes Cut" }, { id: "inner_outline", name: "Inner outline" },
];

const PREVIEW_GRADIENT_ID = "warp-preview-gradient";
const STROKE_PREVIEW_GRADIENT_ID = "warp-stroke-preview-gradient";
const DEFAULT_DECOR_COLOR: FillColor = { type: "solid", hexString: "#b0b8c1" };
const DEFAULT_STROKE_COLOR: FillColor = { type: "solid", hexString: "#000000" };

const THUMB_TEXT_BASE: React.CSSProperties = {
  fontFamily: "Arial Black, -apple-system, BlinkMacSystemFont, sans-serif", fontWeight: 900, fontSize: 15, color: "#111", letterSpacing: "-0.5px",
};

export function TextWarpPanel() {
  const [text, setText] = useState("HELLO, WORLD!");
  const [effect, setEffect] = useState<WarpEffect>("bulge");
  const [color, setColor] = useState<FillColor>(DEFAULT_FILL_COLOR);
  const [customMesh, setCustomMesh] = useState<CustomMeshState>(DEFAULT_CUSTOM_MESH);
  const [startAngle, setStartAngle] = useState<number>(0);
  const baseMeshRef = useRef<CustomMeshState>(DEFAULT_CUSTOM_MESH);

  const [activeTab, setActiveTab] = useState<PanelTab>("general");
  const [fontFamily, setFontFamily] = useState("roboto");
  const [mode, setMode] = useState<AddMode>("editable");
  const [lineHeight, setLineHeight] = useState(1.15);

  const [strokeEnabled, setStrokeEnabled] = useState<boolean>(false);
  const [strokeWidth, setStrokeWidth] = useState<number>(5);
  const [strokeColor, setStrokeColor] = useState<FillColor>(DEFAULT_STROKE_COLOR);

  const [shadowType, setShadowType] = useState<string>("none");
  const [shadowOffset, setShadowOffset] = useState<number>(4);
  const [shadowAngle, setShadowAngle] = useState<number>(45);
  const [shadowColor, setShadowColor] = useState<FillColor>(DEFAULT_FILL_COLOR);
  const [shadowBlur, setShadowBlur] = useState<number>(12);
  const [shadowWidth, setShadowWidth] = useState<number>(3);
  const [shadowBlockStyle, setShadowBlockStyle] = useState<"flat" | "perspective">("flat");

  const [decorationType, setDecorationType] = useState<string>("none");
  const [decorColor, setDecorColor] = useState<FillColor>(DEFAULT_DECOR_COLOR);
  const [decorOpacity, setDecorOpacity] = useState<number>(100);
  const [decorWeight, setDecorWeight] = useState<number>(5);
  const [decorDistance, setDecorDistance] = useState<number>(50);
  const [decorAngle, setDecorAngle] = useState<number>(90);

  const fontUrl = useMemo(() => FONT_FAMILY_OPTIONS.find((opt) => opt.value === fontFamily)?.url ?? FONT_FAMILY_OPTIONS[0].url, [fontFamily]);
  const { font: carouselFont } = useLoadedFont(fontUrl);

  const shadowHexColor = useMemo(() => typeof shadowColor === "string" ? shadowColor : shadowColor.type === "solid" ? shadowColor.hexString : "#000000", [shadowColor]);
  const decorHexColor = useMemo(() => typeof decorColor === "string" ? decorColor : decorColor.type === "solid" ? decorColor.hexString : "#b0b8c1", [decorColor]);
  const strokeHexColor = useMemo(() => typeof strokeColor === "string" ? strokeColor : strokeColor.type === "solid" ? strokeColor.hexString : "#000000", [strokeColor]);

  const { pathData, viewBox, textBounds, isLoading, error } = useSvgTextWarp({ text, effect, fontUrl, customMesh, lineHeight });

  // 360° Start Position Slider Handler
  const handleStartAngleChange = (rawVal: number | number[]) => {
    const rawNum = Array.isArray(rawVal) ? rawVal[0] : rawVal;
    const clampedAngle = Math.round(Math.max(0, Math.min(360, rawNum)));
    setStartAngle(clampedAngle);

    if (effect !== "custom") {
      setEffect("custom");
    }

    const aspect =
      textBounds && textBounds.w > 0 && textBounds.h > 0
        ? Math.max(0.1, textBounds.w / textBounds.h)
        : 3.5;

    if (hasCachedImageContour()) {
      const extracted = rescanCachedContourAtAngle(aspect, clampedAngle);
      if (extracted) {
        const nextMesh = normalizeCustomMesh(extracted);
        setCustomMesh(nextMesh);
        return;
      }
    }

    const rotated = rotateCustomMesh(baseMeshRef.current, clampedAngle, aspect);
    setCustomMesh(rotated);
  };

  const previewCenter = useMemo(() => {
    if (!viewBox) return { cx: 160, cy: 90 };
    const parts = viewBox.split(" ").map(Number);
    if (parts.length === 4) return { cx: parts[0] + parts[2] / 2, cy: parts[1] + parts[3] / 2 };
    return { cx: 160, cy: 90 };
  }, [viewBox]);

  const currentStrokeConfig = { enabled: strokeEnabled, width: strokeWidth, color: strokeColor };

  const { addToDesign, isAdding: isAddingImage } = useAddTextWarpToDesign({
    text, color, thickness: 0, style: "solid", variant: "simple", effect, customMesh, fontUrl, lineHeight,
    shadow: { type: shadowType, offset: shadowOffset, angle: shadowAngle, blur: shadowBlur, width: shadowWidth, blockStyle: shadowBlockStyle, color: shadowColor },
    decoration: decorationType, decorationConfig: { type: decorationType, color: decorColor, opacity: decorOpacity, weight: decorWeight, distance: decorDistance, angle: decorAngle },
    strokeConfig: currentStrokeConfig,
  });

  const { addOrUpdate, isAdding: isAddingEditable, selectedData, isEditingExisting } = useEditableTextWarp();

  useEffect(() => {
    if (!selectedData) return;
    setMode("editable");
    setText(selectedData.text);
    setColor(typeof selectedData.color === "string" ? { type: "solid", hexString: selectedData.color } : (selectedData.color as unknown as FillColor));
    setEffect(selectedData.effect);
    setCustomMesh(selectedData.customMesh);
    baseMeshRef.current = normalizeCustomMesh(selectedData.customMesh);
    setLineHeight(typeof (selectedData as any).lineHeight === "number" ? (selectedData as any).lineHeight : 1.15);
    if (FONT_FAMILY_OPTIONS.some((opt) => opt.value === selectedData.fontFamily)) setFontFamily(selectedData.fontFamily);
    
    if (selectedData.strokeConfig) {
      setStrokeEnabled(selectedData.strokeConfig.enabled); setStrokeWidth(selectedData.strokeConfig.width);
      if (selectedData.strokeConfig.color) setStrokeColor(selectedData.strokeConfig.color as FillColor);
    } else { setStrokeEnabled(false); }

    if (selectedData.shadow) {
      setShadowType(selectedData.shadow.type || "none"); setShadowOffset(selectedData.shadow.offset ?? 4); setShadowAngle(selectedData.shadow.angle ?? 45);
      if (selectedData.shadow.blur !== undefined) setShadowBlur(selectedData.shadow.blur);
      if (selectedData.shadow.width !== undefined) setShadowWidth(selectedData.shadow.width);
      if (selectedData.shadow.blockStyle) setShadowBlockStyle(selectedData.shadow.blockStyle);
      if (selectedData.shadow.color) setShadowColor(selectedData.shadow.color as FillColor);
    }
    if (selectedData.decoration) setDecorationType(selectedData.decoration);
    if (selectedData.decorationConfig) {
      if (selectedData.decorationConfig.color) setDecorColor(selectedData.decorationConfig.color as FillColor);
      if (selectedData.decorationConfig.opacity !== undefined) setDecorOpacity(selectedData.decorationConfig.opacity);
      if (selectedData.decorationConfig.weight !== undefined) setDecorWeight(selectedData.decorationConfig.weight);
      if (selectedData.decorationConfig.distance !== undefined) setDecorDistance(selectedData.decorationConfig.distance);
      if (selectedData.decorationConfig.angle !== undefined) setDecorAngle(selectedData.decorationConfig.angle);
    }
  }, [selectedData]);

  const shadowDx = useMemo(() => { const rad = (shadowAngle * Math.PI) / 180; return shadowOffset * Math.cos(rad); }, [shadowOffset, shadowAngle]);
  const shadowDy = useMemo(() => { const rad = (shadowAngle * Math.PI) / 180; return shadowOffset * Math.sin(rad); }, [shadowOffset, shadowAngle]);

  const resetShadow = () => { setShadowOffset(4); setShadowAngle(45); setShadowBlur(12); setShadowWidth(3); setShadowBlockStyle("flat"); setShadowColor(DEFAULT_FILL_COLOR); };
  const resetDecoration = () => { setDecorColor(DEFAULT_DECOR_COLOR); setDecorOpacity(100); setDecorWeight(5); setDecorDistance(50); setDecorAngle(90); };

  const handleAddOrUpdate = () => {
    const extraConfig = {
      shadow: { type: shadowType, offset: shadowOffset, angle: shadowAngle, blur: shadowBlur, width: shadowWidth, blockStyle: shadowBlockStyle, color: shadowColor },
      decoration: decorationType, decorationConfig: { type: decorationType, color: decorColor, opacity: decorOpacity, weight: decorWeight, distance: decorDistance, angle: decorAngle },
      strokeConfig: currentStrokeConfig,
    };
    if (mode === "image") { addToDesign(); } else {
      addOrUpdate({ text, color, thickness: 0, style: "solid", variant: "simple", effect, customMesh, fontUrl, fontFamily, lineHeight, ...extraConfig });
    }
  };

  const isAdding = mode === "image" ? isAddingImage : isAddingEditable;
  const buttonLabel = isAdding ? "Adding..." : mode === "editable" && isEditingExisting ? "Update design" : "Add to design";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        overflowX: "hidden",
      }}
    >
      {effect === "custom" ? (
        <CustomWarpEditor 
          text={text} 
          pathData={pathData} 
          textBounds={textBounds} 
          isLoading={isLoading} 
          error={error} 
          mesh={customMesh} 
          color={color} 
          startAngle={startAngle}
          strokeConfig={currentStrokeConfig}
          shadowConfig={{ type: shadowType, offset: shadowOffset, angle: shadowAngle, blur: shadowBlur, width: shadowWidth, blockStyle: shadowBlockStyle, color: shadowColor }}
          decorationConfig={{ type: decorationType, color: decorColor, opacity: decorOpacity, weight: decorWeight, distance: decorDistance, angle: decorAngle }}
          onMeshChange={(newMesh) => {
            baseMeshRef.current = newMesh;
            setCustomMesh(newMesh);
          }}
          onResetShape={() => {
            clearCachedImageContour();
            setStartAngle(0);
            baseMeshRef.current = DEFAULT_CUSTOM_MESH;
            setCustomMesh(DEFAULT_CUSTOM_MESH);
          }}
          onBack={() => setEffect("bulge")} 
        />
      ) : (
        <StickyPinned>
          <div
            style={{
              width: "100%",
              maxWidth: "100%",
              height: "220px",
              background: "#f3f3f3",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            {isLoading ? (
              <span style={{ fontSize: "13px", color: "#666" }}>Loading preview...</span>
            ) : error ? (
              <span style={{ fontSize: "13px", color: "red" }}>Error: {error}</span>
            ) : pathData ? (
              <svg
                viewBox={viewBox}
                style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
              >
                <defs>
                  <SvgGradientDef color={color} id={PREVIEW_GRADIENT_ID} />
                  <SvgGradientDef color={strokeColor} id={STROKE_PREVIEW_GRADIENT_ID} />

                  {shadowType === "drop" && (
                    <filter id="drop-shadow-filter" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx={shadowDx} dy={shadowDy} stdDeviation={shadowBlur / 2} floodColor={shadowHexColor} floodOpacity="0.8" />
                    </filter>
                  )}

                  {decorationType === "lines" && (
                    <pattern id="decor-lines-pattern" width="20" height={Math.max(1, decorWeight + decorDistance)} patternUnits="userSpaceOnUse" patternTransform={`rotate(${decorAngle - 90})`}>
                      <rect x="0" y="0" width="20" height={decorWeight} fill={decorHexColor} opacity={decorOpacity / 100} />
                    </pattern>
                  )}

                  {decorationType === "stripes_cut" && (
                    <pattern id="decor-stripes-pattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect x="0" y="0" width="4" height="12" fill={decorHexColor} opacity={decorOpacity / 100} />
                    </pattern>
                  )}

                  {decorationType === "color_cut" && (
                    <clipPath id="decor-cut-clip">
                      <path d={pathData} />
                    </clipPath>
                  )}
                </defs>

                {shadowType === "line" && (
                  <path d={pathData} fill="none" stroke={shadowHexColor} strokeWidth={shadowWidth} strokeLinejoin="round" strokeLinecap="round" transform={`translate(${shadowDx}, ${shadowDy})`} />
                )}

                {shadowType === "block" &&
                  (() => {
                    const stepDist = 1.5; const totalSteps = Math.max(1, Math.ceil(shadowOffset / stepDist));
                    const isPerspective = shadowBlockStyle === "perspective"; const layers = [];
                    for (let i = totalSteps; i >= 1; i--) {
                      const ratio = i / totalSteps; const sx = shadowDx * ratio; const sy = shadowDy * ratio;
                      if (isPerspective) {
                        const scale = 1 - ratio * 0.12;
                        layers.push(<path key={i} d={pathData} fill={shadowHexColor} stroke={shadowHexColor} strokeWidth={1.5} strokeLinejoin="round" transform={`translate(${previewCenter.cx}, ${previewCenter.cy}) translate(${sx}, ${sy}) scale(${scale}) translate(${-previewCenter.cx}, ${-previewCenter.cy})`} />);
                      } else {
                        layers.push(<path key={i} d={pathData} fill={shadowHexColor} stroke={shadowHexColor} strokeWidth={1.5} strokeLinejoin="round" transform={`translate(${sx}, ${sy})`} />);
                      }
                    }
                    return layers;
                  })()}

                {strokeEnabled && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke={getSvgFillAttr(strokeColor, STROKE_PREVIEW_GRADIENT_ID)}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                  />
                )}

                <path d={pathData} fill={getSvgFillAttr(color, PREVIEW_GRADIENT_ID)} filter={shadowType === "drop" ? "url(#drop-shadow-filter)" : undefined} />

                {decorationType === "lines" && <path d={pathData} fill="url(#decor-lines-pattern)" pointerEvents="none" />}
                {decorationType === "stripes_cut" && <path d={pathData} fill="url(#decor-stripes-pattern)" pointerEvents="none" />}
                {decorationType === "color_cut" && <rect x="-50%" y="52%" width="200%" height="38%" fill={decorHexColor} opacity={decorOpacity / 100} clipPath="url(#decor-cut-clip)" pointerEvents="none" />}
                {decorationType === "inner_outline" && <path d={pathData} fill="none" stroke={decorHexColor} strokeWidth={Math.max(1, decorWeight)} strokeOpacity={decorOpacity / 100} strokeLinejoin="round" pointerEvents="none" />}
              </svg>
            ) : (
              <span style={{ fontSize: "13px", color: "#999" }}>Type text to preview</span>
            )}
          </div>
        </StickyPinned>
      )}

      <SegmentedControl options={[{ value: "general", label: "General" }, { value: "style", label: "Style" }]} value={activeTab} onChange={(value) => setActiveTab(value as PanelTab)} />

      {activeTab === "general" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <FormField label="Text" control={() => <MultilineInput autoGrow value={text} onChange={(val) => setText(typeof val === "string" ? val : val?.target?.value ?? "")} />} />
          <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
            <OptionCarousel<WarpOption>
              title="Warp type" options={WARP_OPTIONS} selectedId={effect} onSelect={(id) => setEffect(id as WarpEffect)} showLabel={false}
              renderThumbnail={(opt) => {
                if (opt.isCustom) {
                  const isSelected = effect === opt.id;
                  return (<div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: isSelected ? "#7d2ae8" : "#555" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z" strokeDasharray="3 3" /><circle cx="3" cy="3" r="2" fill="currentColor" /><circle cx="21" cy="3" r="2" fill="currentColor" /><circle cx="3" cy="21" r="2" fill="currentColor" /><circle cx="21" cy="21" r="2" fill="currentColor" /></svg></div>);
                }
                let thumbPath = ""; let thumbViewBox = "0 0 320 180";
                if (carouselFont && text && text.trim()) {
                  try { const result = computeWarpedText(carouselFont, text, opt.effect); if (result) { thumbPath = result.pathData; thumbViewBox = result.viewBox; } } catch (err) {}
                }
                const gradientId = `warp-preset-gradient-${opt.id}`;
                return (<svg viewBox={thumbViewBox} style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}><defs><SvgGradientDef color={color} id={gradientId} /></defs>{thumbPath && !thumbPath.includes("NaN") && <path d={thumbPath} fill={getSvgFillAttr(color, gradientId)} />}</svg>);
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <FormField label="Color" control={() => <GradientColorField value={color} onChange={setColor} />} />
          <FormField label="Select Web Font" control={() => <Select options={FONT_FAMILY_OPTIONS.map(({ value, label }) => ({ value, label }))} value={fontFamily} onChange={(value) => setFontFamily(value as string)} />} />
          <FormField label="Line spacing" control={() => <Slider min={0.8} max={2.5} step={0.05} value={lineHeight} onChange={(val) => setLineHeight(Array.isArray(val) ? val[0] : (val as number))} />} />

          {/* 360° START POSITION SLIDER IN STYLE TAB */}
          <FormField
            label={`Text start position (${startAngle}°)`}
            control={() => (
              <Slider
                min={0}
                max={360}
                step={1}
                value={startAngle}
                onChange={handleStartAngleChange}
              />
            )}
          />

          <hr style={{ border: "0", borderTop: "1px solid #e0e0e0", margin: "4px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <FormField label="Enable Stroke Outline" control={() => <Switch checked={strokeEnabled} onChange={(checked) => setStrokeEnabled(checked)} />} />
            {strokeEnabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingLeft: "12px", borderLeft: "2px solid #e0e0e0", marginLeft: "4px" }}>
                <FormField label="Stroke Color" control={() => <GradientColorField value={strokeColor} onChange={setStrokeColor} />} />
                <FormField label="Stroke Width" control={() => <Slider min={1} max={50} step={1} value={strokeWidth} onChange={(val) => setStrokeWidth(Array.isArray(val) ? val[0] : (val as number))} />} />
              </div>
            )}
          </div>

          <hr style={{ border: "0", borderTop: "1px solid #e0e0e0", margin: "4px 0" }} />
          <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
            <OptionCarousel<ShadowOption>
              title="Shadow" options={SHADOW_OPTIONS} selectedId={shadowType} onSelect={(id) => setShadowType(id)} showLabel={true}
              renderThumbnail={(opt) => {
                switch (opt.id) {
                  case "drop": return <span style={{ ...THUMB_TEXT_BASE, textShadow: "0px 3px 6px rgba(224,32,58,0.75), 0px 5px 12px rgba(224,32,58,0.45)" }}>DROP</span>;
                  case "line": return <span style={{ ...THUMB_TEXT_BASE, textShadow: "2px 2px 0 #e0203a" }}>LINE</span>;
                  case "block": return <span style={{ ...THUMB_TEXT_BASE, textShadow: "1px 1px 0 #e0203a, 2px 2px 0 #e0203a, 3px 3px 0 #e0203a, 4px 4px 0 #e0203a" }}>BLOCK</span>;
                  case "none": default: return <span style={THUMB_TEXT_BASE}>NONE</span>;
                }
              }}
            />
          </div>
          {shadowType !== "none" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <FormField label="Shadow Color" control={() => <GradientColorField value={shadowColor} onChange={setShadowColor} />} />
              <FormField label="Offset" control={() => <Slider min={0} max={50} step={1} value={shadowOffset} onChange={(val) => setShadowOffset(Array.isArray(val) ? val[0] : (val as number))} />} />
              <FormField label="Angle" control={() => <Slider min={0} max={360} step={1} value={shadowAngle} onChange={(val) => setShadowAngle(Array.isArray(val) ? val[0] : (val as number))} />} />
              {shadowType === "drop" && <FormField label="Blur" control={() => <Slider min={0} max={50} step={1} value={shadowBlur} onChange={(val) => setShadowBlur(Array.isArray(val) ? val[0] : (val as number))} />} />}
              {shadowType === "line" && <FormField label="Width" control={() => <Slider min={1} max={20} step={1} value={shadowWidth} onChange={(val) => setShadowWidth(Array.isArray(val) ? val[0] : (val as number))} />} />}
              {shadowType === "block" && <FormField label="Direction" control={() => <SegmentedControl options={[{ value: "flat", label: "Flat" }, { value: "perspective", label: "Perspective" }]} value={shadowBlockStyle} onChange={(val) => setShadowBlockStyle(val as "flat" | "perspective")} />} />}
              <Button onClick={resetShadow} variant="secondary">Reset</Button>
            </div>
          )}

          <hr style={{ border: "0", borderTop: "1px solid #e0e0e0", margin: "4px 0" }} />
          <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
            <OptionCarousel<DecorationOption>
              title="Text Decoration" options={DECORATION_OPTIONS} selectedId={decorationType} onSelect={(id) => setDecorationType(id)} showLabel={true}
              renderThumbnail={(opt) => {
                switch (opt.id) {
                  case "lines": return <span style={{ ...THUMB_TEXT_BASE, backgroundImage: "repeating-linear-gradient(180deg, #111 0px, #111 2.5px, transparent 2.5px, transparent 4.5px)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent", display: "inline-block" }}>LINES</span>;
                  case "color_cut": return <span style={{ ...THUMB_TEXT_BASE, fontSize: 11, position: "relative", display: "inline-block", color: "#111" }}>COLOR CUT<span style={{ position: "absolute", left: 0, right: 0, top: "52%", height: "40%", background: "#e0203a", borderRadius: 1 }} /></span>;
                  case "stripes_cut": return <span style={{ ...THUMB_TEXT_BASE, fontSize: 9.5, letterSpacing: 0, backgroundImage: "repeating-linear-gradient(90deg, #e0203a 0px, #e0203a 2px, transparent 2px, transparent 3.5px)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent", display: "inline-block" }}>STRIPES CUT</span>;
                  case "inner_outline": return <span style={{ ...THUMB_TEXT_BASE, fontSize: 11.5, color: "#fff", WebkitTextStroke: "1px #111", textShadow: "0.5px 0.5px 0 #111, -0.5px -0.5px 0 #111", display: "inline-block" }}>OUTLINE</span>;
                  case "none": default: return <span style={THUMB_TEXT_BASE}>NONE</span>;
                }
              }}
            />
          </div>
          {decorationType === "lines" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <FormField label="Color" control={() => <GradientColorField value={decorColor} onChange={setDecorColor} />} />
              <FormField label="Opacity" control={() => <Slider min={0} max={100} step={1} value={decorOpacity} onChange={(val) => setDecorOpacity(Array.isArray(val) ? val[0] : (val as number))} />} />
              <FormField label="Weight" control={() => <Slider min={1} max={20} step={1} value={decorWeight} onChange={(val) => setDecorWeight(Array.isArray(val) ? val[0] : (val as number))} />} />
              <FormField label="Distance" control={() => <Slider min={0} max={100} step={1} value={decorDistance} onChange={(val) => setDecorDistance(Array.isArray(val) ? val[0] : (val as number))} />} />
              <FormField label="Angle" control={() => <Slider min={0} max={360} step={1} value={decorAngle} onChange={(val) => setDecorAngle(Array.isArray(val) ? val[0] : (val as number))} />} />
              <Button onClick={resetDecoration} variant="secondary">Reset</Button>
            </div>
          )}
        </div>
      )}
      <FormField label="Type" control={() => <SegmentedControl options={[{ value: "editable", label: "Editable" }, { value: "image", label: "Image" }]} value={mode} onChange={(value) => setMode(value as AddMode)} />} />
      <Button onClick={handleAddOrUpdate} disabled={isAdding || !text.trim()} variant="primary">{buttonLabel}</Button>
    </div>
  );
}

export default TextWarpPanel;