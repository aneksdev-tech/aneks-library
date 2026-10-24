import { WatermarkOverlay } from "./WatermarkOverlay";

interface ImageViewerProps {
  url: string;
  alt?: string;
}

export function ImageViewer({
  url,
  alt,
}: ImageViewerProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img
        src={url}
        alt={alt}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        className="
          block
          w-full
          rounded-2xl
          select-none
          pointer-events-none
          [-webkit-user-drag:none]
          [-webkit-touch-callout:none]
        "
      />

      <WatermarkOverlay />

      {/* Invisible interaction shield */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-30"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}