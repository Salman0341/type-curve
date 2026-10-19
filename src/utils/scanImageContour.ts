// src/utils/scanImageContour.ts
import type { CustomMeshPoint } from "./customWarpMath";

export interface ScanContourResult {
  topPoints: CustomMeshPoint[];
  bottomPoints: CustomMeshPoint[];
  preview?: {
    url: string;
    minCol: number;
    minRow: number;
    spanW: number;
    w: number;
    h: number;
  };
}

interface CachedContourData {
  canvas: HTMLCanvasElement;
  hasTrueTransparency: boolean;
}

let lastCachedContour: CachedContourData | null = null;
let lastExtractedResult: ScanContourResult | null = null;
let lastExtractedAngle: number = -1;
let lastExtractedAspect: number = -1;

export function clearCachedImageContour(): void {
  lastCachedContour = null;
  lastExtractedResult = null;
  lastExtractedAngle = -1;
  lastExtractedAspect = -1;
}

export function hasCachedImageContour(): boolean {
  return lastCachedContour !== null;
}

function extractPointsFromRotatedCanvas(
  sourceCanvas: HTMLCanvasElement,
  hasTrueTransparency: boolean,
  textAspectRatio: number,
  startAngleDeg: number = 0
): ScanContourResult {
  if (
    lastExtractedResult &&
    lastExtractedAngle === startAngleDeg &&
    Math.abs(lastExtractedAspect - textAspectRatio) < 0.01
  ) {
    return lastExtractedResult;
  }

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const rotCanvas = document.createElement("canvas");
  rotCanvas.width = w;
  rotCanvas.height = h;
  const ctx = rotCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Canvas context initialize nahi ho saka.");
  }

  if (!hasTrueTransparency) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }

  const angleRad = (((startAngleDeg % 360) + 360) % 360) * (Math.PI / 180);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-angleRad);
  ctx.drawImage(sourceCanvas, -w / 2, -h / 2);
  ctx.restore();

  const data = ctx.getImageData(0, 0, w, h).data;
  const ALPHA_THRESHOLD = 30;

  const isSolidPixel = (col: number, row: number): boolean => {
    const idx = (row * w + col) * 4;
    const a = data[idx + 3];

    if (hasTrueTransparency) return a > ALPHA_THRESHOLD;

    if (a <= ALPHA_THRESHOLD) return false;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);

    if (minC > 170 && maxC - minC < 25) return false;
    return true;
  };

  const topRaw: (number | null)[] = new Array(w).fill(null);
  const bottomRaw: (number | null)[] = new Array(w).fill(null);

  let minCol = w, maxCol = -1;
  let minRow = h, maxRow = -1;

  for (let col = 0; col < w; col++) {
    for (let row = 0; row < h; row++) {
      if (isSolidPixel(col, row)) {
        topRaw[col] = row;
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
        break;
      }
    }
    for (let row = h - 1; row >= 0; row--) {
      if (isSolidPixel(col, row)) {
        bottomRaw[col] = row;
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
        break;
      }
    }
  }

  if (maxCol === -1 || maxRow === -1 || maxCol - minCol < 5) {
    throw new Error("Image mein solid shape nahi mili.");
  }

  const spanW = maxCol - minCol;
  const spanH = Math.max(1, maxRow - minRow);

  for (let col = minCol; col <= maxCol; col++) {
    if (topRaw[col] === null) {
      let l = col - 1; while (l >= minCol && topRaw[l] === null) l--;
      let r = col + 1; while (r <= maxCol && topRaw[r] === null) r++;
      topRaw[col] = ((l >= minCol ? topRaw[l]! : minRow) + (r <= maxCol ? topRaw[r]! : minRow)) / 2;
    }
    if (bottomRaw[col] === null) {
      let l = col - 1; while (l >= minCol && bottomRaw[l] === null) l--;
      let r = col + 1; while (r <= maxCol && bottomRaw[r] === null) r++;
      bottomRaw[col] = ((l >= minCol ? bottomRaw[l]! : maxRow) + (r <= maxCol ? bottomRaw[r]! : maxRow)) / 2;
    }
  }

  const midCol = Math.round((minCol + maxCol) / 2);
  const leftSampleCol = minCol + Math.round(spanW * 0.14);
  const rightSampleCol = maxCol - Math.round(spanW * 0.14);
  const midTop = topRaw[midCol]!;
  const midBottom = bottomRaw[midCol]!;

  const isSymmetricUpwardArch =
    midTop - minRow < spanH * 0.12 &&
    maxRow - midBottom > spanH * 0.25 &&
    topRaw[leftSampleCol]! > midTop + spanH * 0.18 &&
    topRaw[rightSampleCol]! > midTop + spanH * 0.18 &&
    Math.abs(topRaw[leftSampleCol]! - topRaw[rightSampleCol]!) < spanH * 0.22;

  const NUM_POINTS = 7;
  const topPoints: CustomMeshPoint[] = [];
  const bottomPoints: CustomMeshPoint[] = [];

  if (isSymmetricUpwardArch) {
    const halfW = spanW / 2;
    const archRise = Math.min(halfW, spanH);
    const rOut = (halfW * halfW + archRise * archRise) / (2 * Math.max(1, archRise));
    const crownThickness = Math.max(spanH * 0.22, Math.min(spanH * 0.45, midBottom - midTop));
    const rIn = Math.max(rOut * 0.35, rOut - crownThickness);
    const rawAngle = 2 * Math.atan2(archRise, halfW);
    const maxAngle = Math.min(rawAngle, (80 * Math.PI) / 180);

    for (let i = 0; i < NUM_POINTS; i++) {
      const u = i / (NUM_POINTS - 1);
      const alpha = -maxAngle + u * (2 * maxAngle);
      const xTopPx = halfW + rOut * Math.sin(alpha);
      const yTopPx = rOut * (1 - Math.cos(alpha));
      const xBottomPx = halfW + rIn * Math.sin(alpha);
      const yBottomPx = rOut - rIn * Math.cos(alpha);

      topPoints.push({
        id: `t-${i}`,
        x: Number((xTopPx / spanW).toFixed(4)),
        y: Number(((yTopPx / spanW) * textAspectRatio).toFixed(4)),
      });
      bottomPoints.push({
        id: `b-${i}`,
        x: Number((xBottomPx / spanW).toFixed(4)),
        y: Number(((yBottomPx / spanW) * textAspectRatio).toFixed(4)),
      });
    }
  } else {
    for (let i = 0; i < NUM_POINTS; i++) {
      const relX = i / (NUM_POINTS - 1);
      const pxX = Math.round(minCol + relX * spanW);

      const win = Math.max(1, Math.floor(spanW * 0.04));
      let tSum = 0, bSum = 0, cnt = 0;
      for (let c = Math.max(minCol, pxX - win); c <= Math.min(maxCol, pxX + win); c++) {
        if (topRaw[c] !== null && bottomRaw[c] !== null) {
          tSum += topRaw[c]!; bSum += bottomRaw[c]!; cnt++;
        }
      }

      const tAvg = cnt > 0 ? tSum / cnt : minRow;
      let bAvg = cnt > 0 ? bSum / cnt : maxRow;

      const normTopY = ((tAvg - minRow) / spanW) * textAspectRatio;
      let normBottomY = ((bAvg - minRow) / spanW) * textAspectRatio;

      if (normBottomY - normTopY < 0.1) normBottomY = normTopY + 0.1;

      topPoints.push({ id: `t-${i}`, x: Number(relX.toFixed(4)), y: Number(normTopY.toFixed(4)) });
      bottomPoints.push({ id: `b-${i}`, x: Number(relX.toFixed(4)), y: Number(normBottomY.toFixed(4)) });
    }
  }

  let previewUrl = "";
  try {
    previewUrl = rotCanvas.toDataURL("image/webp", 0.5);
  } catch (err) {
    console.warn("Could not generate ghost preview due to CORS:", err);
  }

  const result: ScanContourResult = {
    topPoints,
    bottomPoints,
    ...(previewUrl && {
      preview: { url: previewUrl, minCol, minRow, spanW, w, h }
    })
  };

  lastExtractedResult = result;
  lastExtractedAngle = startAngleDeg;
  lastExtractedAspect = textAspectRatio;

  return result;
}

export function rescanCachedContourAtAngle(
  textAspectRatio: number,
  startAngleDeg: number
): ScanContourResult | null {
  if (!lastCachedContour) return null;
  return extractPointsFromRotatedCanvas(
    lastCachedContour.canvas,
    lastCachedContour.hasTrueTransparency,
    textAspectRatio,
    startAngleDeg
  );
}

export async function scanImageContour(
  fileOrUrl: File | string,
  textAspectRatio: number,
  startAngleDeg: number = 0
): Promise<ScanContourResult> {
  const img = new Image();
  img.crossOrigin = "anonymous";

  let objectUrl: string | null = null;
  if (fileOrUrl instanceof File) {
    objectUrl = URL.createObjectURL(fileOrUrl);
    img.src = objectUrl;
  } else {
    img.src = fileOrUrl;
  }

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load nahi ho saki."));
  });

  const maxDim = 360;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const diag = Math.ceil(Math.hypot(w, h));
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = diag;
  baseCanvas.height = diag;
  const ctx = baseCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw new Error("Canvas context initialize nahi ho saka.");
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true })!;
  tempCtx.drawImage(img, 0, 0, w, h);
  const tempData = tempCtx.getImageData(0, 0, w, h).data;

  if (objectUrl) URL.revokeObjectURL(objectUrl);

  let transparentBorderPixels = 0;
  let totalBorderPixels = 0;
  const patch = Math.max(4, Math.floor(Math.min(w, h) * 0.08));

  for (let r = 0; r < patch; r++) {
    for (let c = 0; c < patch; c++) {
      totalBorderPixels += 4;
      if (tempData[(r * w + c) * 4 + 3] < 30) transparentBorderPixels++;
      if (tempData[(r * w + (w - 1 - c)) * 4 + 3] < 30) transparentBorderPixels++;
      if (tempData[((h - 1 - r) * w + c) * 4 + 3] < 30) transparentBorderPixels++;
      if (tempData[((h - 1 - r) * w + (w - 1 - c)) * 4 + 3] < 30) transparentBorderPixels++;
    }
  }

  const hasTrueTransparency = transparentBorderPixels > totalBorderPixels * 0.25;

  if (!hasTrueTransparency) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, diag, diag);
  }
  ctx.drawImage(img, (diag - w) / 2, (diag - h) / 2, w, h);

  lastCachedContour = { canvas: baseCanvas, hasTrueTransparency };

  return extractPointsFromRotatedCanvas(
    baseCanvas,
    hasTrueTransparency,
    textAspectRatio,
    startAngleDeg
  );
}