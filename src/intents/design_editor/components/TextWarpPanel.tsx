import React, { useState } from "react";
import { MultilineInput, Button } from "@canva/app-ui-kit"; 
import { StylePresetPicker } from "./StylePresetPicker";
import { CustomWarpEditor } from "./CustomWarpEditor";
import { useSvgTextWarp, WarpEffect } from "../hooks/useSvgTextWarp";
import { useAddTextWarpToDesign } from "../hooks/useAddTextWarpToDesign";
import { DEFAULT_CUSTOM_MESH, CustomMeshState } from "../../../utils/customWarpMath";
import fontUrl from "../../../assets/fonts/ArialBlack.ttf";

export function TextWarpPanel() {
  const [text, setText] = useState("HELLO, WORLD!");
  const [effect, setEffect] = useState<WarpEffect>("bulge");
  const [color, setColor] = useState("#000000");
  const [customMesh, setCustomMesh] = useState<CustomMeshState>(DEFAULT_CUSTOM_MESH);

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
  });

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

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", boxSizing: "border-box" }}>
        <label style={{ fontSize: "13px", fontWeight: 600, color: "#333" }}>Text</label>
        <MultilineInput
          autoGrow
          value={text}
          onChange={(val) => setText(typeof val === "string" ? val : val?.target?.value ?? "")}
          placeholder="This is an optional placeholder."
        />
      </div>

      <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}>
        <StylePresetPicker
          selectedEffect={effect}
          onSelectEffect={(newEffect) => setEffect(newEffect)}
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