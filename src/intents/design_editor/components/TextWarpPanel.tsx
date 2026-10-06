import React, { useEffect, useMemo, useState } from "react";
import {
  MultilineInput,
  Button,
  SegmentedControl,
  FormField,
  Select,
  Slider,
} from "@canva/app-ui-kit";
import { OptionCarousel } from "./OptionCarousel";
import { CustomWarpEditor } from "./CustomWarpEditor";
import { GradientColorField } from "./GradientColorField";
import { StickyPinned } from "./StickyPinned";
import { useSvgTextWarp, WarpEffect } from "../hooks/useSvgTextWarp";
import { useLoadedFont } from "../hooks/useLoadedFont";
import { useAddTextWarpToDesign } from "../hooks/useAddTextWarpToDesign";
import { useEditableTextWarp } from "../hooks/useEditableTextWarp";
import { DEFAULT_CUSTOM_MESH, CustomMeshState } from "../../../utils/customWarpMath";
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

interface WarpOption {
  id: string;
  name: string;
  effect: WarpEffect;
  isCustom?: boolean;
}

const WARP_OPTIONS: WarpOption[] = [
  { id: "bulge", name: "Bulge Circle", effect: "bulge" },
  { id: "rise-decrease", name: "Perspective Shrink", effect: "rise-decrease" },
  { id: "rise-increase", name: "Perspective Grow", effect: "rise-increase" },
  { id: "custom", name: "Custom Mesh", effect: "custom", isCustom: true },
];

interface ShadowOption {
  id: string;
  name: string;
}

const SHADOW_OPTIONS: ShadowOption[] = [
  { id: "none", name: "None" },
  { id: "drop", name: "Drop" },
  { id: "line", name: "Line" },
  { id: "block", name: "Block" },
];

interface DecorationOption {
  id: string;
  name: string;
}

const DECORATION_OPTIONS: DecorationOption[] = [
  { id: "none", name: "None" },
  { id: "lines", name: "Lines" },
  { id: "color_cut", name: "Color Cut" },
];

const PREVIEW_GRADIENT_ID = "warp-preview-gradient";

// Fixed (non-live) text-shadow styles for the Shadow carousel thumbnails
// — plain bold "TYPE" label, same shape regardless of the user's real
// text/color/font, matching the reference.
function shadowThumbnailStyle(id: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: "Arial Black, Arial, sans-serif",
    fontWeight: 900,
    fontSize: 16,
    color: "#111",
  };
  if (id === "drop") return { ...base, textShadow: "2px 2px 3px rgba(224,32,58,0.65)" };
  if (id === "line") return { ...base, textShadow: "2px 2px 0 #e0203a" };
  if (id === "block")
    return {
      ...base,
      textShadow: "1px 1px 0 #e0203a, 2px 2px 0 #e0203a, 3px 3px 0 #e0203a, 4px 4px 0 #e0203a",
    };
  return base;
}

export function TextWarpPanel() {
  const [text, setText] = useState("HELLO, WORLD!");
  const [effect, setEffect] = useState<WarpEffect>("bulge");
  const [color, setColor] = useState<FillColor>(DEFAULT_FILL_COLOR);
  const [customMesh, setCustomMesh] = useState<CustomMeshState>(DEFAULT_CUSTOM_MESH);
  const [activeTab, setActiveTab] = useState<PanelTab>("general");
  const [fontFamily, setFontFamily] = useState("roboto");
  const [mode, setMode] = useState<AddMode>("editable");
  const [lineHeight, setLineHeight] = useState(1.15);

  const [shadowType, setShadowType] = useState<string>("none");
  const [shadowOffset, setShadowOffset] = useState<number>(4);
  const [shadowAngle, setShadowAngle] = useState<number>(45);
  const [shadowBlur, setShadowBlur] = useState<number>(12);
  const [shadowColor, setShadowColor] = useState<FillColor>(DEFAULT_FILL_COLOR);

  const [decorationType, setDecorationType] = useState<string>("none");

  const fontUrl = useMemo(
    () => FONT_FAMILY_OPTIONS.find((opt) => opt.value === fontFamily)?.url ?? FONT_FAMILY_OPTIONS[0].url,
    [fontFamily],
  );

  // Used only to compute the live warp-preset thumbnails below — the
  // actual font file is cached (see textToSvgPath.ts), so this doesn't
  // trigger a second network fetch; useSvgTextWarp below loads the same
  // URL independently for the main preview/export.
  const { font: carouselFont } = useLoadedFont(fontUrl);

  const shadowHexColor = useMemo(() => {
    if (typeof shadowColor === "string") return shadowColor;
    if (shadowColor.type === "solid") return shadowColor.hexString;
    return "#000000";
  }, [shadowColor]);

  const { pathData, viewBox, textBounds, isLoading, error } = useSvgTextWarp({
    text,
    effect,
    fontUrl,
    customMesh,
    lineHeight,
  });

  const { addToDesign, isAdding: isAddingImage } = useAddTextWarpToDesign({
    text,
    color,
    thickness: 0,
    style: "solid",
    variant: "simple",
    effect,
    customMesh,
    fontUrl,
    lineHeight,
  });

  const { addOrUpdate, isAdding: isAddingEditable, selectedData, isEditingExisting } =
    useEditableTextWarp();

  useEffect(() => {
    if (!selectedData) return;
    setMode("editable");
    setText(selectedData.text);
    setColor(
      typeof selectedData.color === "string"
        ? { type: "solid", hexString: selectedData.color }
        : (selectedData.color as unknown as FillColor),
    );
    setEffect(selectedData.effect);
    setCustomMesh(selectedData.customMesh);
    setLineHeight(
      typeof (selectedData as any).lineHeight === "number" ? (selectedData as any).lineHeight : 1.15,
    );
    if (FONT_FAMILY_OPTIONS.some((opt) => opt.value === selectedData.fontFamily)) {
      setFontFamily(selectedData.fontFamily);
    }
  }, [selectedData]);

  const shadowDx = useMemo(() => {
    const rad = (shadowAngle * Math.PI) / 180;
    return shadowOffset * Math.cos(rad);
  }, [shadowOffset, shadowAngle]);

  const shadowDy = useMemo(() => {
    const rad = (shadowAngle * Math.PI) / 180;
    return shadowOffset * Math.sin(rad);
  }, [shadowOffset, shadowAngle]);

  const resetShadow = () => {
    setShadowOffset(4);
    setShadowAngle(45);
    setShadowBlur(12);
    setShadowColor(DEFAULT_FILL_COLOR);
  };

  const handleAddOrUpdate = () => {
    const extraConfig = {
      shadow: {
        type: shadowType,
        offset: shadowOffset,
        angle: shadowAngle,
        blur: shadowBlur,
        color: shadowColor,
      },
      decoration: decorationType,
    };

    if (mode === "image") {
      addToDesign();
    } else {
      addOrUpdate({
        text,
        color,
        thickness: 0,
        style: "solid",
        variant: "simple",
        effect,
        customMesh,
        fontUrl,
        fontFamily,
        lineHeight,
        ...extraConfig,
      });
    }
  };

  const isAdding = mode === "image" ? isAddingImage : isAddingEditable;
  const buttonLabel = isAdding
    ? "Adding..."
    : mode === "editable" && isEditingExisting
    ? "Update design"
    : "Add to design";

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
          onMeshChange={(newMesh) => setCustomMesh(newMesh)}
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
              <svg viewBox={viewBox} style={{ width: "100%", height: "100%", display: "block" }}>
                <defs>
                  <SvgGradientDef color={color} id={PREVIEW_GRADIENT_ID} />
                  {shadowType !== "none" && (
                    <filter id="drop-shadow-filter" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow
                        dx={shadowDx}
                        dy={shadowDy}
                        stdDeviation={shadowBlur / 2}
                        floodColor={shadowHexColor}
                        floodOpacity="0.8"
                      />
                    </filter>
                  )}
                </defs>
                <path
                  d={pathData}
                  fill={getSvgFillAttr(color, PREVIEW_GRADIENT_ID)}
                  filter={shadowType !== "none" ? "url(#drop-shadow-filter)" : undefined}
                />
              </svg>
            ) : (
              <span style={{ fontSize: "13px", color: "#999" }}>Type text to preview</span>
            )}
          </div>
        </StickyPinned>
      )}

      <SegmentedControl
        options={[
          { value: "general", label: "General" },
          { value: "style", label: "Style" },
        ]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as PanelTab)}
      />

      {activeTab === "general" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <FormField
            label="Text"
            control={() => (
              <MultilineInput
                autoGrow
                value={text}
                onChange={(val) => setText(typeof val === "string" ? val : val?.target?.value ?? "")}
                placeholder="This is an optional placeholder."
              />
            )}
          />

          <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
            <OptionCarousel<WarpOption>
              title="Warp type"
              options={WARP_OPTIONS}
              selectedId={effect}
              onSelect={(id) => setEffect(id as WarpEffect)}
              renderThumbnail={(opt) => {
                if (opt.isCustom) {
                  const isSelected = effect === opt.id;
                  return (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isSelected ? "#7d2ae8" : "#555",
                        pointerEvents: "none",
                      }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3h18v18H3z" strokeDasharray="3 3" />
                        <circle cx="3" cy="3" r="2" fill="currentColor" />
                        <circle cx="21" cy="3" r="2" fill="currentColor" />
                        <circle cx="3" cy="21" r="2" fill="currentColor" />
                        <circle cx="21" cy="21" r="2" fill="currentColor" />
                      </svg>
                    </div>
                  );
                }

                let thumbPath = "";
                let thumbViewBox = "0 0 320 180";
                if (carouselFont && text && text.trim()) {
                  try {
                    const result = computeWarpedText(carouselFont, text, opt.effect);
                    if (result) {
                      thumbPath = result.pathData;
                      thumbViewBox = result.viewBox;
                    }
                  } catch (err) {
                    console.error("Thumbnail warp error:", err);
                  }
                }
                const gradientId = `warp-preset-gradient-${opt.id}`;

                return (
                  <svg
                    viewBox={thumbViewBox}
                    style={{ width: "100%", height: 48, display: "block", pointerEvents: "none" }}
                    aria-label={opt.name}
                  >
                    <defs>
                      <SvgGradientDef color={color} id={gradientId} />
                    </defs>
                    {thumbPath && !thumbPath.includes("NaN") && (
                      <path d={thumbPath} fill={getSvgFillAttr(color, gradientId)} />
                    )}
                  </svg>
                );
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <FormField
            label="Color"
            control={() => <GradientColorField value={color} onChange={setColor} />}
          />

          <FormField
            label="Select Web Font"
            control={() => (
              <Select
                options={FONT_FAMILY_OPTIONS.map(({ value, label }) => ({ value, label }))}
                value={fontFamily}
                onChange={(value) => setFontFamily(value as string)}
              />
            )}
          />

          <FormField
            label="Line spacing"
            control={() => (
              <Slider
                min={0.8}
                max={2.5}
                step={0.05}
                value={lineHeight}
                onChange={(val) => setLineHeight(Array.isArray(val) ? val[0] : (val as number))}
              />
            )}
          />

          <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
            <OptionCarousel<ShadowOption>
              title="Shadow"
              options={SHADOW_OPTIONS}
              selectedId={shadowType}
              onSelect={(id) => setShadowType(id)}
              renderThumbnail={(opt) => <span style={shadowThumbnailStyle(opt.id)}>TYPE</span>}
            />
          </div>

          {shadowType !== "none" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <FormField
                label="Shadow Color"
                control={() => <GradientColorField value={shadowColor} onChange={setShadowColor} />}
              />
              <FormField
                label="Offset"
                control={() => (
                  <Slider
                    min={0}
                    max={50}
                    step={1}
                    value={shadowOffset}
                    onChange={(val) => setShadowOffset(Array.isArray(val) ? val[0] : (val as number))}
                  />
                )}
              />
              <FormField
                label="Angle"
                control={() => (
                  <Slider
                    min={0}
                    max={360}
                    step={1}
                    value={shadowAngle}
                    onChange={(val) => setShadowAngle(Array.isArray(val) ? val[0] : (val as number))}
                  />
                )}
              />
              <FormField
                label="Blur"
                control={() => (
                  <Slider
                    min={0}
                    max={50}
                    step={1}
                    value={shadowBlur}
                    onChange={(val) => setShadowBlur(Array.isArray(val) ? val[0] : (val as number))}
                  />
                )}
              />
              <Button onClick={resetShadow} variant="secondary">
                Reset
              </Button>
            </div>
          )}

          <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
            <OptionCarousel<DecorationOption>
              title="Text Decoration"
              options={DECORATION_OPTIONS}
              selectedId={decorationType}
              onSelect={(id) => setDecorationType(id)}
              renderThumbnail={(opt) => {
                const base: React.CSSProperties = {
                  fontFamily: "Arial Black, Arial, sans-serif",
                  fontWeight: 900,
                  fontSize: 16,
                  color: "#111",
                };
                if (opt.id === "lines") {
                  return <span style={{ ...base, textDecoration: "underline", textDecorationThickness: 2 }}>LINES</span>;
                }
                if (opt.id === "color_cut") {
                  return (
                    <span style={{ ...base, position: "relative", display: "inline-block" }}>
                      COLOR
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: "55%",
                          height: "30%",
                          background: "#e0203a",
                        }}
                      />
                    </span>
                  );
                }
                return <span style={base}>NONE</span>;
              }}
            />
          </div>
        </div>
      )}

      <FormField
        label="Type"
        control={() => (
          <SegmentedControl
            options={[
              { value: "editable", label: "Editable" },
              { value: "image", label: "Image" },
            ]}
            value={mode}
            onChange={(value) => setMode(value as AddMode)}
          />
        )}
      />

      <Button onClick={handleAddOrUpdate} disabled={isAdding || !text.trim()} variant="primary">
        {buttonLabel}
      </Button>
    </div>
  );
}