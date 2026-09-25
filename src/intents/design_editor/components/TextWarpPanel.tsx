import React, { useEffect, useMemo, useState } from "react";
import {
  MultilineInput,
  Button,
  SegmentedControl,
  FormField,
  Select,
} from "@canva/app-ui-kit";
import { StylePresetPicker } from "./StylePresetPicker";
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
  { value: "poppins-bold", label: "Poppins Bold", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Bold.ttf" },
  { value: "lato", label: "Lato", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lato/Lato-Regular.ttf" },
  { value: "montserrat", label: "Montserrat", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/Montserrat%5Bwght%5D.ttf" },
  { value: "bebas-neue", label: "Bebas Neue", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bebasneue/BebasNeue-Regular.ttf" },
  { value: "righteous", label: "Righteous", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/righteous/Righteous-Regular.ttf" },
  { value: "abril-fatface", label: "Abril Fatface", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/abrilfatface/AbrilFatface-Regular.ttf" },
  { value: "cinzel", label: "Cinzel", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cinzel/Cinzel%5Bwght%5D.ttf" },
  { value: "shadows-into-light", label: "Shadows Into Light", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/shadowsintolight/ShadowsIntoLight.ttf" },
  { value: "permanent-marker", label: "Permanent Marker", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/apache/permanentmarker/PermanentMarker-Regular.ttf" },
  { value: "satisfy", label: "Satisfy", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/apache/satisfy/Satisfy-Regular.ttf" },
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

  const fontUrl = useMemo(
    () => FONT_FAMILY_OPTIONS.find((opt) => opt.value === fontFamily)?.url ?? FONT_FAMILY_OPTIONS[0].url,
    [fontFamily],
  );

  const { pathData, viewBox, textBounds, isLoading, error } = useSvgTextWarp({
    text,
    effect,
    fontUrl,
    customMesh,
  });

  // color is now passed through AS a FillColor (solid or gradient) —
  // buildWarpedImage.ts's WarpRenderArgs.color must accept FillColor too
  // (see earlier message) for this to reach the exported image.
  const { addToDesign, isAdding: isAddingImage } = useAddTextWarpToDesign({
    text,
    color,
    thickness: 0,
    style: "solid",
    variant: "simple",
    effect,
    customMesh,
    fontUrl,
  });

  const { addOrUpdate, isAdding: isAddingEditable, selectedData, isEditingExisting } =
    useEditableTextWarp();

  useEffect(() => {
    if (!selectedData) return;
    setMode("editable");
    setText(selectedData.text);
    // Handles old saved elements that still have a plain string color
    // (from before this change), as well as new FillColor ones.
    setColor(
      typeof selectedData.color === "string"
        ? { type: "solid", hexString: selectedData.color }
        : (selectedData.color as unknown as FillColor),
    );
    setEffect(selectedData.effect);
    setCustomMesh(selectedData.customMesh);
    if (FONT_FAMILY_OPTIONS.some((opt) => opt.value === selectedData.fontFamily)) {
      setFontFamily(selectedData.fontFamily);
    }
  }, [selectedData]);

  const handleAddOrUpdate = () => {
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
      });
    }
  };

  const isAdding = mode === "image" ? isAddingImage : isAddingEditable;
  const buttonLabel = isAdding
    ? "Adding..."
    : mode === "editable" && isEditingExisting
    ? "Update design"
    : "Add to design";

  console.log('Checked ', color);  

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
              </defs>
              <path d={pathData} fill={getSvgFillAttr(color, PREVIEW_GRADIENT_ID)} />
            </svg>
          ) : (
            <span style={{ fontSize: "13px", color: "#999" }}>Type text to preview</span>
          )}
        </div>
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
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
        </div>
      )}

      <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
        <StylePresetPicker
          selectedEffect={effect}
          onSelectEffect={(newEffect) => setEffect(newEffect)}
          text={text}
          fontUrl={fontUrl}
          color={color}
          customMesh={customMesh}
        />
      </div>

      <SegmentedControl
        options={[
          { value: "editable", label: "Editable" },
          { value: "image", label: "Image" },
        ]}
        value={mode}
        onChange={(value) => setMode(value as AddMode)}
      />

      <Button onClick={handleAddOrUpdate} disabled={isAdding || !text.trim()} variant="primary">
        {buttonLabel}
      </Button>
    </div>
  );
}