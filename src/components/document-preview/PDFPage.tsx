import { Page } from "react-pdf";
import { WatermarkOverlay } from "./WatermarkOverlay";

interface PDFPageProps {
  pageNumber: number;
  width: number;
}

export function PDFPage({
  pageNumber,
  width,
}: PDFPageProps) {
  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border bg-background shadow-soft">

      <Page
        pageNumber={pageNumber}
        width={width}
        renderTextLayer
        renderAnnotationLayer
        className="relative z-10"
      />

      <WatermarkOverlay />

    </div>
  );
}