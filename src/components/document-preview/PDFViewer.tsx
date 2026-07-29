import { useEffect, useMemo, useRef, useState, useCallback, } from "react";
import { Document, pdfjs } from "react-pdf";
import { PDFPage } from "./PDFPage";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PDFViewerProps {
  url: string;
}

export function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(900);
  const [visiblePages, setVisiblePages] =
  useState(3);

  const loadMorePages = useCallback(() => {
  setVisiblePages((prev) =>
    Math.min(prev + 3, numPages),
  );
}, [numPages]);

  const containerRef = 
    useRef<HTMLDivElement>(null);
  
  const loaderRef =
    useRef<HTMLDivElement>(null);

  const pdfOptions = useMemo(
  () => ({
    wasmUrl: "/wasm/",
    cMapUrl: "/cmaps/",
    cMapPacked: true,
  }),
  [],
);

  useEffect(() => {
    function updateWidth() {
      if (!containerRef.current) return;

      setPageWidth(
        containerRef.current.clientWidth + 4,
      );
    }

    updateWidth();

    const resizeObserver =
      new ResizeObserver(updateWidth);

    if (containerRef.current) {
      resizeObserver.observe(
        containerRef.current,
      );
    }

    window.addEventListener(
      "resize",
      updateWidth,
    );

    return () => {
      resizeObserver.disconnect();

      window.removeEventListener(
        "resize",
        updateWidth,
      );
    };
  }, []);


  useEffect(() => {
  if (!loaderRef.current) return;

  const observer =
    new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          visiblePages < numPages
        ) {
          loadMorePages();
        }
      },
      {
        rootMargin: "300px",
      },
    );

  observer.observe(loaderRef.current);

  return () => observer.disconnect();
}, [visiblePages, numPages]);


  return (
    <div
      ref={containerRef}
      className="w-full space-y-4"
    >
      <Document
        file={url}
        options={pdfOptions}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
        }}
        onLoadError={(error) => {
          console.error(
            "PDF load failed:",
            error,
          );
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
        {Array.from(
         {
          length: Math.min(
            visiblePages,
            numPages,
          ),
         },
          (_, i) => (
          <PDFPage
          key={i}
          pageNumber={i + 1}
          width={pageWidth}
        />
      ),
    )}

    {visiblePages < numPages && (
  <div
    ref={loaderRef}
    className="h-10"
  />
  )}
      </Document>
    </div>
  );
}