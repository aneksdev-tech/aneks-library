interface WatermarkOverlayProps {
  text?: string;
}

export function WatermarkOverlay({
  text = "ANEKS LIBRARY",
}: WatermarkOverlayProps) {
  const today = new Date().toLocaleDateString();

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
        className="-rotate-[30deg] text-center"
        style={{
          color: "rgba(16, 185, 129, 0.12)",
        }}
      >
        <div
          className="
            font-bold
            uppercase
            tracking-[0.35em]
          "
          style={{
            fontSize: "clamp(2.8rem, 5vw, 4.5rem)",
          }}
        >
          {text}
        </div>

        <div
          className="
            mt-5
            font-semibold
            tracking-[0.25em]
          "
          style={{
            fontSize: "clamp(0.9rem, 1.4vw, 1.2rem)",
          }}
        >
          {today}
        </div>
      </div>
    </div>
  );
}