import { createCanvas } from "@napi-rs/canvas";

export const WATERMARK = {
  text: "ANEKS LIBRARY",

  rotation: 55,

  opacity: 0.18,

  letterSpacing: 6,

  horizontalOffset: 60,
  verticalOffset: -110,

  pdfTitleScale: 0.05,

  imageTitleScale: 0.05,

  color: {
    r: 0,
    g: 0,
    b: 0,
  },
};

export async function createWatermarkImage(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const fontSize =
    Math.min(width, height) *
    WATERMARK.imageTitleScale;

  ctx.clearRect(0, 0, width, height);

  ctx.translate(
    width / 2 + WATERMARK.horizontalOffset,
    height / 2 + WATERMARK.verticalOffset
  );

  ctx.rotate((-WATERMARK.rotation * Math.PI) / 180);

  ctx.fillStyle = `rgba(${WATERMARK.color.r},${WATERMARK.color.g},${WATERMARK.color.b},${WATERMARK.opacity})`;

  ctx.font = `700 ${fontSize}px Arial`;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const text = WATERMARK.text;

  let x = 0;

  const totalWidth =
    [...text].reduce(
      (sum, char) =>
        sum + ctx.measureText(char).width + WATERMARK.letterSpacing,
      0
    ) / 2;

  x = -totalWidth;

  for (const char of text) {
    ctx.fillText(char, x, 0);
    x +=
      ctx.measureText(char).width +
      WATERMARK.letterSpacing;
  }

  return canvas.encode("png");
}