import React from "react";
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
}

const THUMB_SIZE = 84;

// The ONE carousel used for every option-picker in the panel (Warp type,
// Shadow, Text Decoration). It only owns layout, selection state, and
// click/keyboard handling — it has no idea what kind of picker it's
// being used for. Each thumbnail's actual appearance is entirely up to
// the caller via renderThumbnail, so adding a 4th picker later never
// means touching this file.
export function OptionCarousel<T extends CarouselOption>({
  title,
  options,
  selectedId,
  onSelect,
  renderThumbnail,
}: OptionCarouselProps<T>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", boxSizing: "border-box" }}>
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
              onClick={() => onSelect(opt.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(opt.id);
                }
              }}
              style={{
                flex: `0 0 ${THUMB_SIZE}px`,
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                boxSizing: "border-box",
                cursor: "pointer",
                outline: "none",
                borderRadius: 10,
                border: isSelected ? "2px solid #7d2ae8" : "1px solid #e0e0e0",
                background: isSelected ? "#f3ecfd" : "#f9f9f9",
                padding: 4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              {renderThumbnail(opt)}
              <Text size="xsmall">{opt.name}</Text>
            </div>
          );
        })}
      </Carousel>
    </div>
  );
}

export default OptionCarousel;