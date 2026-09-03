<svg 
  viewBox={viewBox} 
  style={{ 
    width: "100%", 
    height: "100%", 
    maxHeight: "180px", 
    display: "block",
    overflow: "visible" 
  }}
>
  {pathData ? (
    <path d={pathData} fill={color || "#000000"} />
  ) : null}
</svg>

export default TextWarpPanel;