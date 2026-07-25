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

export function createWatermarkSvg(width, height) {
  const fontSize =
    Math.min(width, height) *
    WATERMARK.imageTitleScale;

  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${width}"
  height="${height}"
>
  <text
    x="50%"
    y="50%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Arial"
    font-size="${fontSize}"
    font-weight="bold"
    fill="rgba(${WATERMARK.color.r},${WATERMARK.color.g},${WATERMARK.color.b},${WATERMARK.opacity})"
    transform="rotate(${-WATERMARK.rotation}, ${width / 2}, ${height / 2})"
  >
    ${WATERMARK.text}
  </text>
</svg>
`;
}