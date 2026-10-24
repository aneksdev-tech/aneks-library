import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";

interface DocxViewerProps {
  blob: Blob;
}

const WATERMARK_ASSET =
  "/watermark-assets/aneks-watermark.png";

const WATERMARK_OPACITY = 0.4;
const WATERMARK_ROTATION = "-55deg";
const WATERMARK_SCALE = 1.5;

export function DocxViewer({
  blob,
}: DocxViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);

  const resizeObserver =
    useRef<ResizeObserver | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const updateWatermarkSizes = () => {
    if (!documentRef.current) return;

    const pages =
      documentRef.current.querySelectorAll(
        "section.docx-preview",
      );

    pages.forEach((page) => {
      const pageElement = page as HTMLElement;

      const watermark =
        pageElement.querySelector(
          ".aneks-watermark",
        ) as HTMLDivElement | null;

      const image = watermark?.querySelector("img");

      if (!watermark || !image) return;

      const width = pageElement.clientWidth;
      const height = pageElement.clientHeight;

      if (!width || !height) return;

      image.style.width = `${
        Math.round(
          Math.min(width, height) * WATERMARK_SCALE,
        )
      }px`;
    });
  };

  const applyScale = () => {
    if (!wrapperRef.current || !documentRef.current) {
      return;
    }

    const firstPage =
      documentRef.current.querySelector(
        "section.docx-preview",
      ) as HTMLElement | null;

    if (!firstPage) return;

    const wrapperWidth =
      wrapperRef.current.clientWidth;

    const pageWidth = firstPage.offsetWidth;

    if (!pageWidth) return;

    const scale = Math.min(
      1,
      wrapperWidth / pageWidth,
    );

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

    updateWatermarkSizes();
  };

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;

    async function renderDocument() {
      if (!documentRef.current) {
        animationFrame =
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
          },
        );

        if (cancelled) return;

        const pages =
          documentRef.current.querySelectorAll(
            "section.docx-preview",
          );

        pages.forEach((page) => {
          const pageElement = page as HTMLElement;

          pageElement.style.position = "relative";

          pageElement
            .querySelector(".aneks-watermark")
            ?.remove();

          const watermark =
            document.createElement("div");

          watermark.className = "aneks-watermark";

          Object.assign(watermark.style, {
            position: "absolute",
            inset: "0",
            overflow: "hidden",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: "999",
          });

          const image =
            document.createElement("img");

          image.src = WATERMARK_ASSET;
          image.alt = "";
          image.draggable = false;

          Object.assign(image.style, {
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "0",
            height: "auto",
            maxWidth: "none",
            opacity: String(WATERMARK_OPACITY),
            transform:
              `translate(-50%, -50%) rotate(${WATERMARK_ROTATION})`,
          });

          watermark.appendChild(image);
          pageElement.appendChild(watermark);
        });

        applyScale();

        resizeObserver.current?.disconnect();

        resizeObserver.current = new ResizeObserver(() => {
          applyScale();
        });

        if (wrapperRef.current) {
          resizeObserver.current.observe(
            wrapperRef.current,
          );
        }
      } catch (err) {
        console.error(
          "DOCX preview rendering failed:",
          err,
        );

        if (!cancelled) {
          setError(
            "Unable to preview this Word document. Please try again later.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void renderDocument();

    window.addEventListener("resize", applyScale);

    return () => {
      cancelled = true;

      cancelAnimationFrame(animationFrame);

      resizeObserver.current?.disconnect();

      window.removeEventListener(
        "resize",
        applyScale,
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
        <div className="flex items-start justify-center">
          <div ref={documentRef} />
        </div>
      </div>
    </div>
  );
}