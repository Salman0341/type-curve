import React, { useMemo, useState } from "react";
import {
  MultilineInput,
  Button,
  SegmentedControl,
  FormField,
  Select,
  Swatch,
} from "@canva/app-ui-kit";
import type { Anchor, ColorSelectionEvent, ColorSelectionScope } from "@canva/asset";
import { openColorSelector } from "@canva/asset";
import { StylePresetPicker } from "./StylePresetPicker";
import { CustomWarpEditor } from "./CustomWarpEditor";
import { useSvgTextWarp, WarpEffect } from "../hooks/useSvgTextWarp";
import { useAddTextWarpToDesign } from "../hooks/useAddTextWarpToDesign";
import { DEFAULT_CUSTOM_MESH, CustomMeshState } from "../../../utils/customWarpMath";

type PanelTab = "general" | "style";

// Guaranteed CORS-open & Permanent Raw TTF URLs via unpkg / CDN
const FONT_FAMILY_OPTIONS = [
  { value: "roboto", label: "Roboto (Sans-Serif)", url: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf" },
  { value: "open-sans", label: "Open Sans", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/opensans/OpenSans%5Bwdth%2Cwght%5D.ttf" },

  // Sans-serif / Display
  { value: "poppins-bold", label: "Poppins Bold", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Bold.ttf" },
  { value: "lato", label: "Lato", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/lato/Lato-Regular.ttf" },
  { value: "montserrat", label: "Montserrat", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/Montserrat%5Bwght%5D.ttf" },
  { value: "bebas-neue", label: "Bebas Neue", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bebasneue/BebasNeue-Regular.ttf" },
  { value: "righteous", label: "Righteous", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/righteous/Righteous-Regular.ttf" },

  // Serif
  { value: "abril-fatface", label: "Abril Fatface", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/abrilfatface/AbrilFatface-Regular.ttf" },
  { value: "cinzel", label: "Cinzel", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cinzel/Cinzel%5Bwght%5D.ttf" },

  // Script / Handwriting
  { value: "shadows-into-light", label: "Shadows Into Light", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/shadowsintolight/ShadowsIntoLight.ttf" },
  { value: "permanent-marker", label: "Permanent Marker", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/apache/permanentmarker/PermanentMarker-Regular.ttf" },
  { value: "satisfy", label: "Satisfy", url: "https://cdn.jsdelivr.net/gh/google/fonts@main/apache/satisfy/Satisfy-Regular.ttf" },
];

export function TextWarpPanel() {
  const [text, setText] = useState("HELLO, WORLD!");
  const [effect, setEffect] = useState<WarpEffect>("bulge");
  const [color, setColor] = useState("#000000");
  const [customMesh, setCustomMesh] = useState<CustomMeshState>(DEFAULT_CUSTOM_MESH);
  const [activeTab, setActiveTab] = useState<PanelTab>("general");
  const [fontFamily, setFontFamily] = useState("roboto");

  const fontUrl = useMemo(
    () => FONT_FAMILY_OPTIONS.find((opt) => opt.value === fontFamily)?.url ?? FONT_FAMILY_OPTIONS[0].url,
    [fontFamily],
  );

  // SVG rendering hook
  const { pathData, viewBox, textBounds, isLoading, error } = useSvgTextWarp({
    text,
    effect,
    fontUrl,
    customMesh,
  });

  // Canva export hook
  const { addToDesign, isAdding } = useAddTextWarpToDesign({
    text,
    color,
    thickness: 0,
    style: "solid",
    variant: "simple",
    effect,
    customMesh,
    fontUrl,
  });

  const onColorSelect = async <T extends ColorSelectionScope>(
    event: ColorSelectionEvent<T>,
  ) => {
    if (event.selection.type === "solid") {
      setColor(event.selection.hexString);
    }
  };

  const onRequestOpenColorSelector = (boundingRect: Anchor) => {
    openColorSelector(boundingRect, {
      onColorSelect,
      scopes: ["solid"],
    });
  };

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
            <svg
              viewBox={viewBox}
              style={{ width: "100%", height: "100%", display: "block" }}
            >
              <path d={pathData} fill={color} />
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
            control={() => (
              <Swatch
                fill={[color]}
                onClick={(e) =>
                  onRequestOpenColorSelector(e.currentTarget.getBoundingClientRect())
                }
              />
            )}
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
      <Button
        onClick={addToDesign}
        disabled={isAdding || !text.trim()}
        variant="primary"
      >
        {isAdding ? "Adding..." : "Add to design"}
      </Button>
    </div>
  );
}