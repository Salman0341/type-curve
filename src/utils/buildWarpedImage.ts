// src/utils/buildWarpedImage.ts
import { loadFont } from "./textToSvgPath";
import type { TextBounds } from "./warpTransformers";
import {
  createBulgeTransformer,
  createRiseDecreaseTransformer,
  createRiseIncreaseTransformer,
} from "./warpTransformers";
import type { WarpStyle, OutlineVariant } from "./strokeStyle";
import { computeRenderStyle } from "./strokeStyle";
import type { WarpEffect } from "../intents/design_editor/hooks/useSvgTextWarp";
import type { CustomMeshState } from "./customWarpMath";
import {
  DEFAULT_CUSTOM_MESH,
  createCustomMeshTransformer,
} from "./customWarpMath";
import type { FillColor } from "./fillColor";
import { toRepresentativeHex, toSvgFill } from "./fillColor";
import { flattenCurves } from "./pathSubdivide";
import { getMultilinePath } from "./multilineTextPath";

export interface ShadowConfig {
  type: string;
  offset: number;
  angle: number;
  blur?: number;
  width?: number;
  blockStyle?: "flat" | "perspective";
  color: FillColor | string;
}

export interface DecorationConfig {
  type: string;
  color?: FillColor | string;
  opacity?: number;
  weight?: number;
  distance?: number;
  angle?: number;
}

export interface StrokeConfig {
  enabled: boolean;
  width: number;
  color: FillColor | string;
}

export interface WarpRenderArgs {
  text: string;
  color: FillColor;
  thickness: number;
  style: WarpStyle;
  variant: OutlineVariant;
  effect?: WarpEffect;
  customMesh?: CustomMeshState;
  fontUrl: string;
  lineHeight?: number;
  shadow?: ShadowConfig;
  decoration?: string;
  decorationConfig?: DecorationConfig;
  strokeConfig?: StrokeConfig;
}

export async function buildExportSvgMarkup(
  args: WarpRenderArgs,
): Promise<{ svgMarkup: string; width: number; height: number }> {
  const font = await loadFont(args.fontUrl);
  const baseFontSize = 100;

  const path = getMultilinePath(font, args.text, baseFontSize, args.lineHeight ?? 1.15);
  path.commands = flattenCurves(path.commands as any) as any;

  const naturalBB = path.getBoundingBox();
  const naturalWidth = Math.max(naturalBB.x2 - naturalBB.x1, 1);
  const naturalHeight = Math.max(naturalBB.y2 - naturalBB.y1, 1);

  const effect = args.effect || "bulge";

  if (effect !== "none") {
    let transformPoint: (x: number, y: number) => { x: number; y: number };

    if (effect === "custom") {
      const meshTransform = createCustomMeshTransformer(args.customMesh ?? DEFAULT_CUSTOM_MESH);
      transformPoint = (x: number, y: number) => {
        const res = meshTransform(x - naturalBB.x1, y - naturalBB.y1, naturalWidth, naturalHeight);
        return { x: naturalBB.x1 + res.x, y: naturalBB.y1 + res.y };
      };
    } else {
      const bounds: TextBounds = { minX: naturalBB.x1, maxX: naturalBB.x2, minY: naturalBB.y1, maxY: naturalBB.y2 };
      const sideTransform = effect === "rise-decrease" ? createRiseDecreaseTransformer(bounds) : effect === "rise-increase" ? createRiseIncreaseTransformer(bounds) : createBulgeTransformer(bounds);
      transformPoint = (x: number, y: number) => sideTransform(x, y);
    }

    path.commands = path.commands.map((cmd: any) => {
      const c = { ...cmd };
      if (typeof c.x === "number" && typeof c.y === "number") {
        const p = transformPoint(c.x, c.y); c.x = p.x; c.y = p.y;
      }
      if (typeof c.x1 === "number" && typeof c.y1 === "number") {
        const p1 = transformPoint(c.x1, c.y1); c.x1 = p1.x; c.y1 = p1.y;
      }
      if (typeof c.x2 === "number" && typeof c.y2 === "number") {
        const p2 = transformPoint(c.x2, c.y2); c.x2 = p2.x; c.y2 = p2.y;
      }
      return c;
    });
  }

  const d = path.toPathData(4);

  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  path.commands.forEach((cmd: any) => {
    const processPoint = (x?: number, y?: number) => {
      if (typeof x === "number" && !isNaN(x)) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
      if (typeof y === "number" && !isNaN(y)) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
    };
    processPoint(cmd.x, cmd.y); processPoint(cmd.x1, cmd.y1); processPoint(cmd.x2, cmd.y2);
  });

  if (!isFinite(minX)) minX = naturalBB.x1;
  if (!isFinite(maxX)) maxX = naturalBB.x2;
  if (!isFinite(minY)) minY = naturalBB.y1;
  if (!isFinite(maxY)) maxY = naturalBB.y2;

  const actualWidth = Math.max(maxX - minX, 1);
  const actualHeight = Math.max(maxY - minY, 1);
  const centerX = minX + actualWidth / 2;
  const centerY = minY + actualHeight / 2;

  const renderStyle = computeRenderStyle(args.style, args.variant, args.thickness);

  const strokeColorFallback = toRepresentativeHex(args.color);
  const gradientId = `warp-export-gradient-${Math.random().toString(36).substring(2, 9)}`;
  const { fillAttr, defsMarkup } = toSvgFill(args.color, gradientId);

  // --- STROKE LOGIC (Fixed for Gradients) ---
  let customStrokeElement = "";
  let strokeDefsMarkup = "";
  if (args.strokeConfig && args.strokeConfig.enabled) {
    const strokeGradientId = `warp-stroke-gradient-${Math.random().toString(36).substring(2, 9)}`;
    // Gradient aur Solid dono support karne ke liye toSvgFill use kiya
    const strokeFillRes = toSvgFill(args.strokeConfig.color, strokeGradientId);
    strokeDefsMarkup = strokeFillRes.defsMarkup;
    
    customStrokeElement = `<path d="${d}" fill="none" stroke="${strokeFillRes.fillAttr}" stroke-width="${args.strokeConfig.width}" stroke-linejoin="round" />`;
  }

  // --- DYNAMIC SHADOW PRESET LOGIC ---
  let shadowFilterMarkup = ""; let shadowUnderlayElements = ""; let filterAttribute = "";
  if (args.shadow && args.shadow.type !== "none") {
    const rad = (args.shadow.angle * Math.PI) / 180;
    const dx = args.shadow.offset * Math.cos(rad); const dy = args.shadow.offset * Math.sin(rad);
    const shadowHex = typeof args.shadow.color === "string" ? args.shadow.color : toRepresentativeHex(args.shadow.color);

    if (args.shadow.type === "drop") {
      const blurVal = args.shadow.blur ?? 12;
      const filterId = `export-shadow-filter-${Math.random().toString(36).substring(2, 9)}`;
      shadowFilterMarkup = `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${blurVal / 2}" flood-color="${shadowHex}" flood-opacity="0.8"/></filter>`;
      filterAttribute = ` filter="url(#${filterId})"`;
    } else if (args.shadow.type === "line") {
      const lineWidth = args.shadow.width ?? 3;
      shadowUnderlayElements = `<path d="${d}" fill="none" stroke="${shadowHex}" stroke-width="${lineWidth}" stroke-linejoin="round" stroke-linecap="round" transform="translate(${dx}, ${dy})" />`;
    } else if (args.shadow.type === "block") {
      const stepDist = 1.5; const totalSteps = Math.max(1, Math.ceil(args.shadow.offset / stepDist));
      const isPerspective = args.shadow.blockStyle === "perspective";
      const layers: string[] = [];
      for (let i = totalSteps; i >= 1; i--) {
        const ratio = i / totalSteps; const sx = dx * ratio; const sy = dy * ratio;
        if (isPerspective) {
          const scale = 1 - ratio * 0.12;
          layers.push(`<path d="${d}" fill="${shadowHex}" stroke="${shadowHex}" stroke-width="1.5" stroke-linejoin="round" transform="translate(${centerX}, ${centerY}) translate(${sx}, ${sy}) scale(${scale}) translate(${-centerX}, ${-centerY})" />`);
        } else {
          layers.push(`<path d="${d}" fill="${shadowHex}" stroke="${shadowHex}" stroke-width="1.5" stroke-linejoin="round" transform="translate(${sx}, ${sy})" />`);
        }
      }
      shadowUnderlayElements = layers.join("");
    }
  }

  // --- TEXT DECORATION LOGIC ---
  let decorDefsMarkup = ""; let decorElement = "";
  const decorType = args.decorationConfig?.type ?? args.decoration ?? "none";
  if (decorType !== "none") {
    const decorCfg = args.decorationConfig;
    const decorHex = typeof decorCfg?.color === "string" ? decorCfg.color : decorCfg?.color ? toRepresentativeHex(decorCfg.color) : "#b0b8c1";
    const opacity = (decorCfg?.opacity ?? 100) / 100; const weight = decorCfg?.weight ?? 5; const distance = decorCfg?.distance ?? 50; const angle = decorCfg?.angle ?? 90;

    if (decorType === "lines") {
      const patternId = `decor-lines-pattern-${Math.random().toString(36).substring(2, 9)}`;
      const step = Math.max(1, weight + distance); const rot = angle - 90;
      decorDefsMarkup = `<pattern id="${patternId}" width="20" height="${step}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot})"><rect x="0" y="0" width="20" height="${weight}" fill="${decorHex}" opacity="${opacity}" /></pattern>`;
      decorElement = `<path d="${d}" fill="url(#${patternId})" />`;
    } else if (decorType === "color_cut") {
      const cutY = minY + actualHeight * 0.52; const cutH = actualHeight * 0.38;
      const clipId = `decor-cut-clip-${Math.random().toString(36).substring(2, 9)}`;
      decorDefsMarkup = `<clipPath id="${clipId}"><path d="${d}" /></clipPath>`;
      decorElement = `<rect x="${minX - 10}" y="${cutY}" width="${actualWidth + 20}" height="${cutH}" fill="${decorHex}" opacity="${opacity}" clip-path="url(#${clipId})" />`;
    } else if (decorType === "stripes_cut") {
      const patternId = `decor-stripes-pattern-${Math.random().toString(36).substring(2, 9)}`;
      decorDefsMarkup = `<pattern id="${patternId}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect x="0" y="0" width="4" height="12" fill="${decorHex}" opacity="${opacity}" /></pattern>`;
      decorElement = `<path d="${d}" fill="url(#${patternId})" />`;
    } else if (decorType === "inner_outline") {
      decorElement = `<path d="${d}" fill="none" stroke="${decorHex}" stroke-width="${Math.max(1, weight)}" stroke-opacity="${opacity}" stroke-linejoin="round" />`;
    }
  }

  const strokeElements = !renderStyle.isSolid && args.thickness > 0
      ? renderStyle.layers.map((layer) => `<path d="${d}" fill="none" stroke="${strokeColorFallback}" stroke-opacity="${layer.strokeOpacity}" stroke-width="${layer.strokeWidth}" stroke-linejoin="${renderStyle.strokeLinejoin}" stroke-dasharray="${renderStyle.strokeDasharray}" />`).join("")
      : "";

  const fillElement = `<path d="${d}" fill="${fillAttr}"${filterAttribute} />`;

  // Stroke Defs ko combine kar diya
  const combinedDefs = [defsMarkup, strokeDefsMarkup, shadowFilterMarkup, decorDefsMarkup].filter(Boolean).join("");
  const defsSection = combinedDefs ? `<defs>${combinedDefs}</defs>` : "";

  const customStrokePadding = args.strokeConfig?.enabled ? args.strokeConfig.width : 0;
  const shadowPadding = args.shadow && args.shadow.type !== "none" ? args.shadow.offset + (args.shadow.blur ?? 0) + (args.shadow.width ?? 0) : 0;
  const strokePadding = (args.thickness > 0 ? args.thickness * 2 : 0) + customStrokePadding;
  
  const horizontalClearance = Math.max(actualWidth * 0.08, 16) + strokePadding + shadowPadding;
  const verticalClearance = Math.max(actualHeight * 0.08, 16) + strokePadding + shadowPadding;

  const vbX = minX - horizontalClearance;
  const vbY = minY - verticalClearance;
  const vbW = actualWidth + horizontalClearance * 2;
  const vbH = actualHeight + verticalClearance * 2;

  const exportW = Math.round(vbW * 3);
  const exportH = Math.round(vbH * 3);

  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${exportW}" height="${exportH}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">${defsSection}<g>${shadowUnderlayElements}${customStrokeElement}${fillElement}${decorElement}${strokeElements}</g></svg>`;

  return { svgMarkup, width: exportW, height: exportH };
}