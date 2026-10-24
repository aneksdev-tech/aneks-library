import { supabase } from "@/integrations/supabase/client";

function getSafeFilename(filename: string): string {
  return (
    filename
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .trim() || "resource"
  );
}

function getFilenameFromDisposition(
  disposition: string | null,
): string | null {
  if (!disposition) return null;

  // Prefer filename* because it supports UTF-8 characters.
  const encodedMatch = disposition.match(
    /filename\*\s*=\s*UTF-8''([^;]+)/i,
  );

  if (encodedMatch?.[1]) {
    try {
      const filename = decodeURIComponent(
        encodedMatch[1]
          .trim()
          .replace(/^"|"$/g, ""),
      );

      if (filename.trim()) {
        return filename;
      }
    } catch {
      // Fall back to the regular filename.
    }
  }

  // Support both quoted and unquoted filename parameters.
  const regularMatch = disposition.match(
    /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i,
  );

  const filename = (
    regularMatch?.[1] ?? regularMatch?.[2]
  )?.trim();

  return filename || null;
}

function triggerBlobDownload(
  blob: Blob,
  filename: string,
) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = getSafeFilename(filename);
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

export async function downloadResource(
  resourceId: string,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Please sign in.");
  }

  const url =
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-resource`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey:
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resourceId }),
  });

  if (!response.ok) {
    const contentType =
      response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const result = await response.json();

      throw new Error(
        result.error ?? "Download failed.",
      );
    }

    throw new Error("Download failed.");
  }

  const contentType =
    response.headers.get("content-type") ?? "";

  // Images, PDFs, and DOCX files are returned directly by the Edge Function.
  if (
    contentType.startsWith("image/") ||
    contentType.includes("application/pdf") ||
    contentType.includes(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
  ) {
    const blob = await response.blob();

    const disposition =
      response.headers.get("content-disposition");

    const serverFilename =
      getFilenameFromDisposition(disposition);

    const isDocx = contentType.includes(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    const filename =
      serverFilename ??
      (isDocx
        ? "resource.docx"
        : contentType.includes("application/pdf")
          ? "resource.pdf"
          : contentType.includes("image/png")
            ? "resource.png"
            : contentType.includes("image/webp")
              ? "resource.webp"
              : "resource.jpg");

    triggerBlobDownload(blob, filename);
    return;
  }

  // Other file types are returned as a signed Storage URL.
  const result: { url?: string } = await response.json();

  if (!result.url) {
    throw new Error("The download link was not returned.");
  }

  window.open(
    result.url,
    "_blank",
    "noopener,noreferrer",
  );
}