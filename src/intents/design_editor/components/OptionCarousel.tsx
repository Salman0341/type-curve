import React, { useRef } from "react";
import { Carousel, Text } from "@canva/app-ui-kit";

export interface CarouselOption {
  id: string;
  name: string;
}

interface OptionCarouselProps<T extends CarouselOption> {
  title: string;
  options: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  renderThumbnail: (option: T) => React.ReactNode;
  showLabel?: boolean;
}

const THUMB_SIZE = 72;

export function OptionCarousel<T extends CarouselOption>({
  title,
  options,
  selectedId,
  onSelect,
  renderThumbnail,
  showLabel = true,
}: OptionCarouselProps<T>) {
  // Drag / Ghost-Click Guard:
  // Tracks whether the pointer down actually happened on THIS specific card
  const pointerDownRef = useRef<{ id: string; x: number; y: number } | null>(
    null,
  );

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    pointerDownRef.current = {
      id,
      x: e.clientX,
      y: e.clientY,
    };
  };

  const handleCardClick = (id: string, e: React.MouseEvent) => {
    const downInfo = pointerDownRef.current;
    pointerDownRef.current = null;

    // 1. Agar pointer down iss card par nahi hua tha (e.g. arrow button par hua tha), click ignore karein
    if (!downInfo || downInfo.id !== id) {
      return;
    }

    // 2. Agar user ne drag/scroll kiya hai (movement > 6px), click ignore karein
    const distance = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y);
    if (distance > 6) {
      return;
    }

    onSelect(id);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <Text size="small" variant="bold">
        {title}
      </Text>

      <Carousel>
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;

          return (
            <div
              key={opt.id}
              role="button"
              tabIndex={0}
              onPointerDown={(e) => handlePointerDown(opt.id, e)}
              onClick={(e) => handleCardClick(opt.id, e)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(opt.id);
                }
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                flex: `0 0 ${THUMB_SIZE}px`,
                cursor: "pointer",
                outline: "none",
                userSelect: "none",
              }}
            >
              {/* Rounded Box Card */}
              <div
                style={{
                  width: THUMB_SIZE,
                  height: THUMB_SIZE,
                  boxSizing: "border-box",
                  borderRadius: 14,
                  border: isSelected
                    ? "2px solid #7d2ae8"
                    : "1px solid #e0e0e0",
                  background: isSelected ? "#fff" : "#f4f4f4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 4,
                  overflow: "hidden",
                  transition: "all 0.15s ease",
                }}
              >
                {renderThumbnail(opt)}
              </div>

              {/* Card Label */}
              {showLabel && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? "#7d2ae8" : "#333",
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  {opt.name}
                </span>
              )}
            </div>
          );
        })}
      </Carousel>
    </div>
  );
}

export default OptionCarousel;
