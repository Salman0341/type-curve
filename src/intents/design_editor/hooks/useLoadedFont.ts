import { useEffect, useState } from "react";
import opentype from "opentype.js";

// Global cache for deduplicating network requests across multiple components
const fontPromiseCache = new Map<string, Promise<opentype.Font>>();

/**
 * Direct ArrayBuffer fetcher without silent swallowing or infinite hanging callbacks.
 */
async function fetchAndParseFont(fontUrl: string): Promise<opentype.Font> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s strict timeout

  try {
    const response = await fetch(fontUrl, {
      signal: controller.signal,
      headers: {
        Accept: "font/ttf, font/otf, font/woff, application/font-sfnt, */*",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // Validate empty or corrupt buffer before opentype parsing
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error("Received empty font file buffer");
    }

    // Direct opentype parsing from ArrayBuffer
    const parsedFont = opentype.parse(arrayBuffer);
    
    if (!parsedFont || !parsedFont.supported) {
      throw new Error("Unsupported font format (Ensure it is TTF, OTF, or WOFF1. WOFF2 is not supported by opentype.js)");
    }

    return parsedFont;
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      throw new Error(`Font fetch timed out after 10s for URL: ${fontUrl}`);
    }

    // Catch Network/CORS failures explicitly
    if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
      throw new Error(`CORS or Network failure when fetching font from: ${fontUrl}`);
    }

    throw err;
  }
}

/**
 * Thread-safe Cache Manager
 */
function loadFontCached(fontUrl: string): Promise<opentype.Font> {
  if (!fontUrl || fontUrl.trim() === "") {
    return Promise.reject(new Error("Font URL is empty or undefined"));
  }

  if (fontPromiseCache.has(fontUrl)) {
    return fontPromiseCache.get(fontUrl)!;
  }

  const promise = fetchAndParseFont(fontUrl);

  // If promise fails, purge from cache so retry attempts are clean
  promise.catch(() => {
    fontPromiseCache.delete(fontUrl);
  });

  fontPromiseCache.set(fontUrl, promise);
  return promise;
}

export function useLoadedFont(fontUrl: string) {
  const [font, setFont] = useState<opentype.Font | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!fontUrl) {
      setFont(null);
      setIsLoading(false);
      setError("No font URL provided");
      return;
    }

    // Reset state immediately on fontUrl change to prevent stale renders
    setFont(null);
    setIsLoading(true);
    setError(null);

    loadFontCached(fontUrl)
      .then((loadedFont) => {
        if (isMounted) {
          setFont(loadedFont);
          setIsLoading(false);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          console.error(`[useLoadedFont Execution Error]:`, err.message);
          setError(err.message || "Failed to load font");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [fontUrl]);

  return { font, isLoading, error };
}