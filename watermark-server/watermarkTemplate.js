import TextToSVG from "text-to-svg";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const textToSVG = TextToSVG.loadSync(
  path.join(
    __dirname,
    "fonts",
    "NotoSans-Regular.ttf"
  )
);

export const WATERMARK = {
  text: "ANEKS LIBRARY",

  rotation: 55,

  opacity: 0.18,

  horizontalOffset: 60,

  verticalOffset: -110,

  pdfTitleScale: 0.05,

  imageTitleScale: 0.07,

  letterSpacing: 6,

  color: {
    r: 0,
    g: 0,
    b: 0,
  },
};

export function createWatermarkSvg(width, height) {
  const fontSize =
    Math.min(width, height) *
    WATERMARK.imageTitleScale;

  const svgPath = textToSVG.getD(
  WATERMARK.text,
  {
    x: 0,
    y: 0,
    fontSize,
    anchor: "center middle",
    letterSpacing: WATERMARK.letterSpacing,
  }
);

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
>
  <g
    transform="
      translate(${width / 2 + WATERMARK.horizontalOffset}
      ${height / 2 + WATERMARK.verticalOffset})
      rotate(${-WATERMARK.rotation})
    "
  >
    <path
      d="${svgPath}"
      fill="rgba(${WATERMARK.color.r},${WATERMARK.color.g},${WATERMARK.color.b},${WATERMARK.opacity})"
      paint-order="fill"
    />
  </g>
</svg>
`;
}