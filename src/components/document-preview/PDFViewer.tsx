import { useEffect, useRef, useState } from "react";
import { Document, pdfjs } from "react-pdf";
import { PDFPage } from "./PDFPage";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  url: string;
}

export function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(900);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateWidth() {
      if (!containerRef.current) return;

      setPageWidth(containerRef.current.clientWidth + 4);
    }

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", updateWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full space-y-4"
    >
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
        }}
        loading={
          <div className="flex h-64 items-center justify-center rounded-2xl border bg-muted/30">
            Loading PDF...
          </div>
        }
        error={
          <div className="flex h-64 items-center justify-center rounded-2xl border bg-muted/30 text-sm text-muted-foreground">
            Failed to load PDF preview.
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <PDFPage
            key={i}
            pageNumber={i + 1}
            width={pageWidth}
          />
        ))}
      </Document>
    </div>
  );
}