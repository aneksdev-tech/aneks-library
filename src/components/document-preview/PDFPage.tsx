import { useEffect, useRef, useState, } from "react";
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

const pageRef =
  useRef<HTMLDivElement>(null);

const [visible, setVisible] =
  useState(pageNumber <= 2);

const renderScale =
  window.innerWidth < 768 ||
  window.devicePixelRatio > 2
    ? 1.5
    : 2;

useEffect(() => {
  if (!pageRef.current || visible)
    return;

  const observer =
    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "300px",
      },
    );

  observer.observe(pageRef.current);

  return () =>
    observer.disconnect();
}, [visible]);

  return (
    <div 
      ref={pageRef}
      className="relative mb-4 overflow-hidden rounded-2xl border bg-background shadow-soft">
      {visible ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          scale={renderScale}
          devicePixelRatio={1}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="relative z-10"
        />
      ) : (
        <div
          style={{
            height: width * 1.42,
        }}
        className="flex items-center justify-center bg-muted text-sm text-muted-foreground"
      >
    Loading page...
  </div>
  )}

  <WatermarkOverlay />
    </div>
  );
}