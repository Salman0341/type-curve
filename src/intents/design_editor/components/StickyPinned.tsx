import React, { useEffect, useRef, useState } from "react";

// A position:sticky-like effect that works even when Canva's own panel
// chrome breaks real CSS `position: sticky` (a `transform` somewhere in
// the ancestor chain, used for panel slide animations, becomes sticky's
// containing block instead of the real scroll container).
//
// Rather than guessing which ancestor scrolls (fragile — different
// overflow values like auto/scroll/overlay, unexpected DOM structure),
// this listens for scroll events on `window` with `capture: true`.
// Scroll events don't bubble, but a capture-phase listener on window
// still fires for a scroll happening on ANY nested scrollable element,
// because the capture phase travels top-down through window before
// reaching the actual target — so `event.target` always tells us
// exactly which element scrolled, with zero DOM-walking/guessing.
export function StickyPinned({ children }: { children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);
  const [rect, setRect] = useState<{ left: number; width: number; top: number } | null>(null);
  const stuckHeightRef = useRef(0);

  useEffect(() => {
    const handleScroll = (e?: Event) => {
      const node = contentRef.current;
      const placeholder = placeholderRef.current;
      if (!node || !placeholder) return;

      // The element that actually scrolled — whatever it is, wherever
      // it is in the tree. Falls back to 0 (viewport top) only for the
      // very first call below, before any real scroll has happened.
      const scrollEl = e?.target instanceof HTMLElement ? e.target : null;
      const containerTop = scrollEl ? scrollEl.getBoundingClientRect().top : 0;

      const placeholderTop = placeholder.getBoundingClientRect().top;
      const shouldStick = placeholderTop <= containerTop;

      if (shouldStick) {
        if (!stuckHeightRef.current) stuckHeightRef.current = node.offsetHeight;
        const r = node.getBoundingClientRect();
        setRect({ left: r.left, width: r.width, top: containerTop });
      }
      setStuck(shouldStick);
    };

    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    window.addEventListener("resize", handleScroll as any);
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true } as any);
      window.removeEventListener("resize", handleScroll as any);
    };
  }, []);

  return (
    <>
      <div ref={placeholderRef} style={{ height: stuck ? stuckHeightRef.current : 0 }} />
      <div
        ref={contentRef}
        style={
          stuck && rect
            ? {
                position: "fixed",
                top: rect.top,
                left: rect.left,
                width: rect.width,
                zIndex: 50,
              }
            : { position: "static" }
        }
      >
        {children}
      </div>
    </>
  );
}

export default StickyPinned;