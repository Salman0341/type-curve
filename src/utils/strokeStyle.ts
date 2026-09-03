// src/utils/strokeStyle.ts
export type WarpStyle = "solid" | "outline";
export type OutlineVariant = "classic" | "sharp" | "dashed" | "double";

export interface StrokeLayer {
  strokeWidth: number;
  strokeOpacity: number;
}

export interface RenderStyleProps {
  isSolid: boolean;
  strokeLinejoin: "round" | "miter";
  strokeDasharray: string; // "" = solid line
  layers: StrokeLayer[]; // 1 layer normally, 2 layers for "double"
}

export function computeRenderStyle(
  style: WarpStyle,
  variant: OutlineVariant,
  thickness: number,
): RenderStyleProps {
  if (style === "solid") {
    return {
      isSolid: true,
      strokeLinejoin: "round",
      strokeDasharray: "",
      layers: [],
    };
  }

  switch (variant) {
    case "sharp":
      return {
        isSolid: false,
        strokeLinejoin: "miter",
        strokeDasharray: "",
        layers: [{ strokeWidth: thickness, strokeOpacity: 1 }],
      };
    case "dashed":
      return {
        isSolid: false,
        strokeLinejoin: "round",
        strokeDasharray: `${thickness * 1.5} ${thickness}`,
        layers: [{ strokeWidth: thickness, strokeOpacity: 1 }],
      };
    case "double":
      return {
        isSolid: false,
        strokeLinejoin: "round",
        strokeDasharray: "",
        layers: [
          { strokeWidth: thickness * 2.2, strokeOpacity: 0.35 },
          { strokeWidth: thickness, strokeOpacity: 1 },
        ],
      };
    case "classic":
    default:
      return {
        isSolid: false,
        strokeLinejoin: "round",
        strokeDasharray: "",
        layers: [{ strokeWidth: thickness, strokeOpacity: 1 }],
      };
  }
}
