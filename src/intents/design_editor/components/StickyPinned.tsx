import React, { useEffect, useRef, useState } from "react";

// A position:sticky-like effect for Canva extensions.
// Fixed to ignore horizontal / child scrolls (like Carousels).
export function StickyPinned({ children }: { children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);
  const [rect, setRect] = useState<{
    left: number;
    width: number;
    top: number;
  } | null>(null);
  const stuckHeightRef = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleScroll = (e?: Event) => {
      const node = contentRef.current;
      const placeholder = placeholderRef.current;
      if (!node || !placeholder) return;

      const targetEl = e?.target instanceof HTMLElement ? e.target : null;

      // GUARD: Agar scroll hone wala element placeholder ka ancestor NAHI hai
      // (jaise ke Carousel ka horizontal scroll track), toh isko completely ignore karein!
      if (targetEl && !targetEl.contains(placeholder)) {
        return;
      }

      if (targetEl && targetEl.contains(placeholder)) {
        scrollContainerRef.current = targetEl;
      }

      const activeContainer = scrollContainerRef.current;
      const containerTop = activeContainer
        ? activeContainer.getBoundingClientRect().top
        : 0;

      const placeholderRect = placeholder.getBoundingClientRect();
      const shouldStick = placeholderRect.top <= containerTop;

      if (shouldStick) {
        if (!stuckHeightRef.current) {
          stuckHeightRef.current = node.offsetHeight;
        }
        // Width aur left hamesha placeholder se lete hain jo document flow mein rehta hai
        setRect({
          left: placeholderRect.left,
          width: placeholderRect.width,
          top: containerTop,
        });
      }

      setStuck(shouldStick);
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", handleScroll as any);
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll, {
        capture: true,
      } as any);
      window.removeEventListener("resize", handleScroll as any);
    };
  }, []);

  return (
    <>
      <div
        ref={placeholderRef}
        style={{
          height: stuck ? stuckHeightRef.current : 0,
          width: "100%",
          boxSizing: "border-box",
        }}
      />
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
                boxSizing: "border-box",
              }
            : { position: "static", width: "100%", boxSizing: "border-box" }
        }
      >
        {children}
      </div>
    </>
  );
}

export default StickyPinned;
