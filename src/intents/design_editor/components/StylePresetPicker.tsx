// import React from "react";
// import { Carousel, Text } from "@canva/app-ui-kit";
// import { useLoadedFont } from "../hooks/useLoadedFont";
// import type { WarpEffect } from "../../../utils/warpTextCompute";
// import { computeWarpedText } from "../../../utils/warpTextCompute";
// import type { CustomMeshState } from "../../../utils/customWarpMath";
// import type { FillColor } from "../../../utils/fillColor";
// import { DEFAULT_FILL_COLOR } from "../../../utils/fillColor";
// import { SvgGradientDef, getSvgFillAttr } from "../../../utils/svgGradientDefs";

// export interface PresetOption {
//   id: string;
//   name: string;
//   effect?: WarpEffect;
//   isCustom?: boolean;
//   isPro?: boolean;
// }

// export const PRESETS: PresetOption[] = [
//   { id: "bulge", name: "Bulge Circle", effect: "bulge" },
//   { id: "rise-decrease", name: "Perspective Shrink", effect: "rise-decrease" },
//   { id: "rise-increase", name: "Perspective Grow", effect: "rise-increase" },
//   { id: "custom", name: "Custom Mesh", effect: "custom", isCustom: true },
// ];

// export { PRESETS as STYLE_PRESETS };

// const THUMB_SIZE = 84;

// interface StylePresetPickerProps {
//   title?: string;
//   presets?: PresetOption[];
//   selectedEffect?: WarpEffect | string;
//   onSelectEffect?: (effect: WarpEffect | string) => void;
//   selectedId?: string;
//   onSelect?: (id: string) => void;
//   text?: string;
//   fontUrl?: string;
//   color?: FillColor;
//   customMesh?: CustomMeshState;
//   mode?: "warp" | "shadow" | "decoration";
// }

// // Static (non-live) preview of each shadow kind — plain bold "TYPE"
// // label with a fixed CSS text-shadow, independent of the user's real
// // text/color/font, matching the reference thumbnails exactly. Only
// // "none" and "drop" are usable (not Pro); "line"/"block" render the
// // same way but are disabled from selection below.
// function ShadowThumbnail({ id }: { id: string }) {
//   const common: React.CSSProperties = {
//     fontFamily: "Arial Black, Arial, sans-serif",
//     fontWeight: 900,
//     fontSize: 16,
//     color: "#111",
//   };
//   if (id === "drop") {
//     return <span style={{ ...common, textShadow: "2px 2px 3px rgba(224,32,58,0.65)" }}>TYPE</span>;
//   }
//   if (id === "line") {
//     return <span style={{ ...common, textShadow: "2px 2px 0 #e0203a" }}>TYPE</span>;
//   }
//   if (id === "block") {
//     return (
//       <span
//         style={{
//           ...common,
//           textShadow:
//             "1px 1px 0 #e0203a, 2px 2px 0 #e0203a, 3px 3px 0 #e0203a, 4px 4px 0 #e0203a",
//         }}
//       >
//         TYPE
//       </span>
//     );
//   }
//   return <span style={common}>TYPE</span>;
// }

// // Static preview of each text-decoration kind.
// function DecorationThumbnail({ id }: { id: string }) {
//   const common: React.CSSProperties = {
//     fontFamily: "Arial Black, Arial, sans-serif",
//     fontWeight: 900,
//     fontSize: 16,
//     color: "#111",
//   };
//   if (id === "lines") {
//     return <span style={{ ...common, textDecoration: "underline", textDecorationThickness: 2 }}>LINES</span>;
//   }
//   if (id === "color_cut") {
//     return (
//       <span style={{ ...common, position: "relative", display: "inline-block" }}>
//         COLOR
//         <span
//           style={{
//             position: "absolute",
//             left: 0,
//             right: 0,
//             top: "55%",
//             height: "30%",
//             background: "#e0203a",
//             mixBlendMode: "normal" as const,
//             clipPath: "polygon(0 0, 100% 0, 100% 100%, 0% 100%)",
//           }}
//         />
//       </span>
//     );
//   }
//   return <span style={common}>NONE</span>;
// }

// export function StylePresetPicker({
//   title = "Warp type",
//   presets = PRESETS,
//   selectedEffect,
//   onSelectEffect,
//   selectedId,
//   onSelect,
//   text = "",
//   fontUrl = "",
//   color = DEFAULT_FILL_COLOR,
//   mode = "warp",
// }: StylePresetPickerProps) {
//   const { font } = useLoadedFont(fontUrl);

//   const activeSelected = selectedId || selectedEffect;

//   const handlePresetClick = (preset: PresetOption) => {
//     if (preset.isPro) return; // Pro-locked options aren't selectable yet
//     const targetValue = preset.effect || preset.id;
//     if (typeof onSelectEffect === "function") {
//       onSelectEffect(targetValue as WarpEffect);
//     }
//     if (typeof onSelect === "function") {
//       onSelect(targetValue);
//     }
//   };

//   return (
//     <div
//       style={{
//         display: "flex",
//         flexDirection: "column",
//         gap: 8,
//         width: "100%",
//         boxSizing: "border-box",
//       }}
//     >
//       <Text size="small" variant="bold">
//         {title}
//       </Text>

//       <Carousel>
//         {presets.map((preset) => {
//           const isSelected =
//             activeSelected === preset.id || activeSelected === preset.effect;
//           const gradientId = `warp-preset-gradient-${preset.id}`;

//           let pathData = "";
//           let viewBox = "0 0 320 180";

//           if (
//             mode === "warp" &&
//             !preset.isCustom &&
//             font &&
//             text &&
//             text.trim() &&
//             preset.effect
//           ) {
//             try {
//               const result = computeWarpedText(font, text, preset.effect);
//               if (result) {
//                 pathData = result.pathData;
//                 viewBox = result.viewBox;
//               }
//             } catch (err) {
//               console.error("Thumbnail warp error:", err);
//             }
//           }

//           return (
//             <div
//               key={preset.id}
//               role="button"
//               tabIndex={0}
//               onClick={() => handlePresetClick(preset)}
//               onKeyDown={(e) => {
//                 if (e.key === "Enter" || e.key === " ") {
//                   e.preventDefault();
//                   handlePresetClick(preset);
//                 }
//               }}
//               style={{
//                 position: "relative",
//                 flex: `0 0 ${THUMB_SIZE}px`,
//                 width: THUMB_SIZE,
//                 height: THUMB_SIZE,
//                 boxSizing: "border-box",
//                 cursor: preset.isPro ? "not-allowed" : "pointer",
//                 outline: "none",
//                 borderRadius: 10,
//                 border: isSelected ? "2px solid #7d2ae8" : "1px solid #e0e0e0",
//                 background: isSelected ? "#f3ecfd" : "#f9f9f9",
//                 padding: 4,
//                 display: "flex",
//                 flexDirection: "column",
//                 alignItems: "center",
//                 justifyContent: "center",
//                 gap: 4,
//                 opacity: preset.isPro ? 0.9 : 1,
//               }}
//             >
//               {mode === "shadow" ? (
//                 <ShadowThumbnail id={preset.id} />
//               ) : mode === "decoration" ? (
//                 <DecorationThumbnail id={preset.id} />
//               ) : preset.isCustom ? (
//                 <div
//                   style={{
//                     display: "flex",
//                     flexDirection: "column",
//                     alignItems: "center",
//                     justifyContent: "center",
//                     gap: 4,
//                     color: isSelected ? "#7d2ae8" : "#555",
//                     pointerEvents: "none",
//                   }}
//                 >
//                   <svg
//                     width="28"
//                     height="28"
//                     viewBox="0 0 24 24"
//                     fill="none"
//                     stroke="currentColor"
//                     strokeWidth="2"
//                   >
//                     <path d="M3 3h18v18H3z" strokeDasharray="3 3" />
//                     <circle cx="3" cy="3" r="2" fill="currentColor" />
//                     <circle cx="21" cy="3" r="2" fill="currentColor" />
//                     <circle cx="3" cy="21" r="2" fill="currentColor" />
//                     <circle cx="21" cy="21" r="2" fill="currentColor" />
//                   </svg>
//                   <Text size="xsmall" variant="bold">
//                     Custom
//                   </Text>
//                 </div>
//               ) : (
//                 <svg
//                   viewBox={viewBox}
//                   style={{
//                     width: "100%",
//                     height: "100%",
//                     display: "block",
//                     pointerEvents: "none",
//                   }}
//                   aria-label={preset.name}
//                 >
//                   <defs>
//                     <SvgGradientDef color={color} id={gradientId} />
//                   </defs>
//                   {pathData && !pathData.includes("NaN") && (
//                     <path d={pathData} fill={getSvgFillAttr(color, gradientId)} />
//                   )}
//                 </svg>
//               )}

//               <Text size="xsmall">{preset.name}</Text>

//               {preset.isPro && (
//                 <span
//                   style={{
//                     position: "absolute",
//                     bottom: 4,
//                     right: 4,
//                     background: "#333",
//                     color: "#fff",
//                     fontSize: 9,
//                     fontWeight: 700,
//                     borderRadius: 4,
//                     padding: "1px 4px",
//                   }}
//                 >
//                   PRO
//                 </span>
//               )}
//             </div>
//           );
//         })}
//       </Carousel>
//     </div>
//   );
// }

// export default StylePresetPicker;