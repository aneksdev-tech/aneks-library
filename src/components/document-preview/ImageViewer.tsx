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
          w-full
          rounded-2xl
          select-none
          pointer-events-none
          [-webkit-user-drag:none]
          [-webkit-touch-callout:none]
        "
      />

      {/* Image watermark */}
      <div
        className="
          absolute
          inset-0
          flex
          items-center
          justify-center
          pointer-events-none
          select-none
          z-10
        "
      >
        <span
          className="
            text-5xl
            md:text-7xl
            font-extrabold
            uppercase
            tracking-[0.4em]
            text-black/5
            rotate-[-35deg]
            whitespace-nowrap
          "
        >
          Aneks Library
        </span>
      </div>

      {/* Invisible interaction shield */}
      <div
        className="absolute inset-0 z-20"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}