export const WATERMARK = {
  text: "ANEKS LIBRARY",

  rotation: 55,

  opacity: 0.18,

  letterSpacing: "0.25em",

  // Position adjustments
  horizontalOffset: 60,

  verticalOffset: -110,

   // PDF & DOCX
  pdfTitleScale: 0.05,

  // Images
  imageTitleScale: 0.05,

    color: {
    r: 0,
    g: 0,
    b: 0,
  },
};

export function createWatermarkSvg(
  width,
  height,
) {
  const fontSize =
  Math.min(width, height) *
  WATERMARK.imageTitleScale;

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
>
  <style>
    text {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      font-size: ${fontSize}px;
      letter-spacing: ${WATERMARK.letterSpacing};
      text-transform: uppercase;
      fill: rgba(0,0,0,${WATERMARK.opacity});
    }
  </style>

  <g
    transform="translate(${width / 2},${height / 2}) rotate(${-WATERMARK.rotation})"
  >
    <text
      text-anchor="middle"
      dominant-baseline="middle"
    >
      ${WATERMARK.text}
    </text>
  </g>
</svg>
`;
}