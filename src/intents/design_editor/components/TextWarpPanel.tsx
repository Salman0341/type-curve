import React, { useEffect, useMemo, useState } from "react";
import {
  MultilineInput,
  Button,
  SegmentedControl,
  FormField,
  Select,
  Slider,
} from "@canva/app-ui-kit";
import { StylePresetPicker, PresetOption } from "./StylePresetPicker";
import { CustomWarpEditor } from "./CustomWarpEditor";
import { GradientColorField } from "./GradientColorField";
import { useSvgTextWarp, WarpEffect } from "../hooks/useSvgTextWarp";
import { useAddTextWarpToDesign } from "../hooks/useAddTextWarpToDesign";
import { useEditableTextWarp } from "../hooks/useEditableTextWarp";
import { DEFAULT_CUSTOM_MESH, CustomMeshState } from "../../../utils/customWarpMath";
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

const SHADOW_OPTIONS: PresetOption[] = [
  { id: "none", name: "None" },
  { id: "drop", name: "Drop" },
  { id: "line", name: "Line", isPro: true },
  { id: "block", name: "Block", isPro: true },
];

const DECORATION_OPTIONS: PresetOption[] = [
  { id: "none", name: "None" },
  { id: "lines", name: "Lines" },
  { id: "color_cut", name: "Color Cut" },
];

const PREVIEW_GRADIENT_ID = "warp-preview-gradient";

export function TextWarpPanel() {
  const [text, setText] = useState("HELLO, WORLD!");
  const [effect, setEffect] = useState<WarpEffect>("bulge");
  const [color, setColor] = useState<FillColor>(DEFAULT_FILL_COLOR);
  const [customMesh, setCustomMesh] = useState<CustomMeshState>(DEFAULT_CUSTOM_MESH);
  const [activeTab, setActiveTab] = useState<PanelTab>("general");
  const [fontFamily, setFontFamily] = useState("roboto");
  const [mode, setMode] = useState<AddMode>("editable");
  const [lineHeight, setLineHeight] = useState(1.15);

  // --- Shadow States ---
  const [shadowType, setShadowType] = useState<string>("none");
  const [shadowOffset, setShadowOffset] = useState<number>(4);
  const [shadowAngle, setShadowAngle] = useState<number>(45);
  const [shadowBlur, setShadowBlur] = useState<number>(12);
  const [shadowColor, setShadowColor] = useState<FillColor>(DEFAULT_FILL_COLOR);

  // --- Text Decoration State ---
  const [decorationType, setDecorationType] = useState<string>("none");

  const fontUrl = useMemo(
    () => FONT_FAMILY_OPTIONS.find((opt) => opt.value === fontFamily)?.url ?? FONT_FAMILY_OPTIONS[0].url,
    [fontFamily],
  );

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
      {/* Preview Box */}
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
      )}

      {/* Tabs Control */}
      <SegmentedControl
        options={[
          { value: "general", label: "General" },
          { value: "style", label: "Style" },
        ]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as PanelTab)}
      />

      {/* TAB 1: GENERAL (Text Input & Warp Type Selection) */}
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

          {/* Warp Type Carousel shifted to General Tab */}
          <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
            <StylePresetPicker
              title="Warp type"
              selectedEffect={effect}
              onSelectEffect={(newEffect) => setEffect(newEffect as WarpEffect)}
              text={text}
              fontUrl={fontUrl}
              color={color}
              customMesh={customMesh}
              mode="warp"
            />
          </div>
        </div>
      ) : (
        /* TAB 2: STYLE (Color, Fonts, Line Spacing, Shadow, Text Decoration) */
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

          {/* Shadow Carousel */}
          <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
            <StylePresetPicker
              title="Shadow"
              presets={SHADOW_OPTIONS}
              selectedId={shadowType}
              onSelect={(id) => setShadowType(id)}
              mode="shadow"
            />
          </div>

          {/* Shadow Options (Rendered only when Shadow is active) */}
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

          {/* Text Decoration Carousel */}
          <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
            <StylePresetPicker
              title="Text Decoration"
              presets={DECORATION_OPTIONS}
              selectedId={decorationType}
              onSelect={(id) => setDecorationType(id)}
              mode="decoration"
            />
          </div>
        </div>
      )}

      {/* Global Type & Action Buttons */}
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