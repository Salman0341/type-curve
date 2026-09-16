import { useEffect, useState } from "react";
import opentype from "opentype.js";

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

// Module-level cache (not a ref) so it's shared across EVERY component
// instance that calls this hook with the same URL — the main preview and
// all 4 preset thumbnails end up sharing one single network fetch instead
// of five.
const fontPromiseCache = new Map<string, Promise<opentype.Font>>();

function loadFontCached(fontUrl: string): Promise<opentype.Font> {
  if (!fontPromiseCache.has(fontUrl)) {
    fontPromiseCache.set(
      fontUrl,
      (async () => {
        try {
          const response = await withTimeout(fetch(fontUrl), 8000, "Font load timed out");
          if (!response.ok) throw new Error(`Font fetch status: ${response.status}`);
          const buffer = await response.arrayBuffer();
          return opentype.parse(buffer);
        } catch (fetchErr) {
          return withTimeout(
            new Promise<opentype.Font>((resolve, reject) => {
              opentype.load(fontUrl, (err, f) => {
                if (err || !f) reject(err || new Error("Font load failed"));
                else resolve(f);
              });
            }),
            8000,
            "Font load timed out",
          );
        }
      })(),
    );
    // If loading fails, drop the cached (rejected) promise so a later
    // retry can actually try again instead of replaying the same failure.
    fontPromiseCache.get(fontUrl)!.catch(() => fontPromiseCache.delete(fontUrl));
  }
  return fontPromiseCache.get(fontUrl)!;
}

export function useLoadedFont(fontUrl: string) {
  const [font, setFont] = useState<opentype.Font | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    loadFontCached(fontUrl)
      .then((loaded) => {
        if (isMounted) {
          setFont(loaded);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || "Failed to load font");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [fontUrl]);

  return { font, isLoading, error };
}