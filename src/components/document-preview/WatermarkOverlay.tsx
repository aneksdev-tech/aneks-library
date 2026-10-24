import { useEffect, useRef, useState } from "react";

const WATERMARK_ASSET =
  "/watermark-assets/aneks-watermark.png";

const WATERMARK_OPACITY = 0.4;
const WATERMARK_ROTATION = "-55deg";
const WATERMARK_SCALE = 1.5;

export function WatermarkOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [watermarkWidth, setWatermarkWidth] = useState(0);

  useEffect(() => {
    const overlay = overlayRef.current;
    const container = overlay?.parentElement;

    if (!container) return;

    const updateSize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (!width || !height) return;

      setWatermarkWidth(
        Math.round(Math.min(width, height) * WATERMARK_SCALE),
      );
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="
        pointer-events-none
        absolute
        inset-0
        z-20
        overflow-hidden
        select-none
      "
    >
      {watermarkWidth > 0 && (
        <img
          src={WATERMARK_ASSET}
          alt=""
          draggable={false}
          className="absolute max-w-none"
          style={{
            left: "50%",
            top: "50%",
            width: `${watermarkWidth}px`,
            height: "auto",
            opacity: WATERMARK_OPACITY,
            transform: `translate(-50%, -50%) rotate(${WATERMARK_ROTATION})`,
          }}
        />
      )}
    </div>
  );
}