import { PREVIEW_WATERMARK } from "./watermarkConfig";

export function WatermarkOverlay() {
  return (
    <div
      className="
        pointer-events-none
        absolute
        inset-0
        z-20
        flex
        items-center
        justify-center
        select-none
      "
    >
      <div
        style={{
          transform: `rotate(${PREVIEW_WATERMARK.rotation})`,
          color: PREVIEW_WATERMARK.color,
        }}
      >
        <div
          className="
            font-bold
            uppercase
            whitespace-nowrap
          "
          style={{
            fontSize:
              PREVIEW_WATERMARK.titleFontSize,
            letterSpacing:
              PREVIEW_WATERMARK.titleLetterSpacing,
          }}
        >
          {PREVIEW_WATERMARK.text}
        </div>
      </div>
    </div>
  );
}