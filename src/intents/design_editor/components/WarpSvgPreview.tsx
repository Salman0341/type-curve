import type { WarpEffect } from "../hooks/useSvgTextWarp";
import { useSvgTextWarp } from "../hooks/useSvgTextWarp";
import type { WarpStyle, OutlineVariant } from "../../../utils/strokeStyle";
import { computeRenderStyle } from "../../../utils/strokeStyle";
import fontUrl from "../../../assets/fonts/ArialBlack.ttf";

const VIEWBOX_SIZE = 320;

interface WarpSvgPreviewProps {
  text: string;
  color: string;
  thickness: number;
  style: WarpStyle;
  variant: OutlineVariant;
  effect: WarpEffect;
}

export function WarpSvgPreview({
  text,
  color,
  thickness,
  style,
  variant,
  effect,
}: WarpSvgPreviewProps) {
  const { pathData, viewBox, isLoading, error } = useSvgTextWarp({
    text,
    effect,
    fontUrl,
    viewBoxWidth: VIEWBOX_SIZE,
    viewBoxHeight: VIEWBOX_SIZE,
  });

  const renderStyle = computeRenderStyle(style, variant, thickness);

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        borderRadius: 8,
        background: "#f5f5f5",
        boxSizing: "border-box",
        padding: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <svg
        viewBox={viewBox || `0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"  
        style={{
          display: "block",
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        {pathData && (
          <>
            {!renderStyle.isSolid &&
              renderStyle.layers.map((layer, i) => (
                <path
                  key={i}
                  d={pathData}
                  fill="none"
                  stroke={color}
                  strokeOpacity={layer.strokeOpacity}
                  strokeWidth={layer.strokeWidth}
                  strokeLinejoin={renderStyle.strokeLinejoin}
                  strokeDasharray={renderStyle.strokeDasharray}
                />
              ))}

            <path d={pathData} fill={color} />
          </>
        )}

        {isLoading && !pathData && (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            fontSize="12"
            fill="#ffffff"
          >
            Loading…
          </text>
        )}
        {error && (
          <text x="50%" y="50%" textAnchor="middle" fontSize="10" fill="red">
            Error rendering text
          </text>
        )}
      </svg>
    </div>
  );
}
