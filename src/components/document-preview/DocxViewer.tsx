import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";

interface DocxViewerProps {
  blob: Blob;
}

export function DocxViewer({
  blob,
}: DocxViewerProps) {
  const wrapperRef =
    useRef<HTMLDivElement>(null);

  const documentRef =
    useRef<HTMLDivElement>(null);

  const resizeObserver =
    useRef<ResizeObserver | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const applyScale = () => {
  if (
    !wrapperRef.current ||
    !documentRef.current
  )
    return;

  const firstPage =
    documentRef.current.querySelector(
      "section.docx-preview"
    ) as HTMLElement | null;

  if (!firstPage) return;

  const wrapperWidth =
    wrapperRef.current.clientWidth;

  const pageWidth =
    firstPage.offsetWidth;

  if (!pageWidth) return;

  const scale =
    Math.min(1, wrapperWidth / pageWidth);

  documentRef.current.style.transform =
    `scale(${scale})`;

  documentRef.current.style.transformOrigin =
    "top center";

  documentRef.current.style.width =
    `${pageWidth}px`;

  documentRef.current.style.margin =
    "0 auto";

  const originalHeight =
    documentRef.current.scrollHeight;

  documentRef.current.style.height =
    `${originalHeight * scale}px`;
};

  useEffect(() => {
  let cancelled = false;

  async function renderDocument() {
    if (!documentRef.current) {
      requestAnimationFrame(renderDocument);
      return;
    }

    setLoading(true);
    setError("");

    try {
      documentRef.current.innerHTML = "";

      await renderAsync(
        blob,
        documentRef.current,
        undefined,
        {
          className: "docx-preview",
          inWrapper: true,
          breakPages: true,
        }
      );

      if (cancelled) return;

      const pages =
        documentRef.current.querySelectorAll(
          "section.docx-preview"
        );

      pages.forEach((page) => {
        const pageEl =
          page as HTMLElement;

        pageEl.style.position =
          "relative";

        const old =
          pageEl.querySelector(
            ".aneks-watermark"
          );

        old?.remove();

        const watermark =
          document.createElement("div");

        watermark.className =
          "aneks-watermark";

        watermark.textContent =
          "Aneks Library";

        Object.assign(
          watermark.style,
          {
            position: "absolute",
            inset: "0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: "999",

            fontSize: "4rem",
            fontWeight: "700",
            letterSpacing: ".35rem",
            textTransform: "uppercase",

            color:
              "rgba(0,0,0,.05)",

            transform:
              "rotate(-35deg)",
          }
        );

        pageEl.appendChild(
          watermark
        );
      });

      applyScale();

      resizeObserver.current?.disconnect();

      resizeObserver.current =
        new ResizeObserver(() => {
          applyScale();
        });

      if (wrapperRef.current) {
        resizeObserver.current.observe(
          wrapperRef.current
        );
      }
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Unable to preview document."
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  renderDocument();

window.addEventListener(
  "resize",
  applyScale
);

return () => {
  cancelled = true;

  resizeObserver.current?.disconnect();

  window.removeEventListener(
    "resize",
    applyScale
  );
};
}, [blob]);

  return (
  <div className="relative w-full">

    {/* Loading */}
    {loading && (
      <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-background/90">
        <span className="text-sm font-medium">
          Loading Word document...
        </span>
      </div>
    )}

    {/* Error */}
    {error && (
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-background/90 text-center">
        <p className="font-semibold text-destructive">
          Failed to load Word document.
        </p>

        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {error}
        </p>
      </div>
    )}

    {/* Viewer */}
    <div
      ref={wrapperRef}
      className="
        w-full
        overflow-hidden
        rounded-2xl
        border
        bg-muted/20
        p-4
      "
    >
      <div
        className="
          flex
          justify-center
          items-start
        "
      >
        <div
          ref={documentRef}
        />
      </div>
    </div>

  </div>
);
}