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

  // Support quoted and unquoted filename parameters.
  const regularMatch = disposition.match(
    /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i,
  );

  const filename = (
    regularMatch?.[1] ?? regularMatch?.[2]
  )?.trim();

  return filename || null;
}

function getFilenameFromResource(
  filename: string | null | undefined,
  contentType: string,
): string {
  const extension = contentType.includes("application/pdf")
    ? ".pdf"
    : contentType.includes(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
      ? ".docx"
      : contentType.includes("image/png")
        ? ".png"
        : contentType.includes("image/webp")
          ? ".webp"
          : contentType.startsWith("image/")
            ? ".jpg"
            : "";

  const original = filename?.trim();

  if (!original) {
    return `resource${extension}`;
  }

  // Preserve Unicode characters, including ñ, and apostrophes.
  // Replace only characters that are unsafe in local filenames.
  const safeOriginal = getSafeFilename(original);

  if (!extension) {
    return safeOriginal;
  }

  // Match the actual output format, since the Edge Function may
  // convert the uploaded file to PDF or an image format.
  const withoutExtension = safeOriginal.replace(/\.[^.]+$/, "");

  return `${withoutExtension || "resource"}${extension}`;
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

    // The filename is already stored in the resources table.
    // Use it when Content-Disposition is missing.
    const { data: resource, error } = await supabase
      .from("resources")
      .select("file_name")
      .eq("id", resourceId)
      .maybeSingle();

    if (error) {
      console.error(
        "Could not retrieve resource filename:",
        error.message,
      );
    }

    const filename =
      serverFilename ??
      getFilenameFromResource(
        resource?.file_name,
        contentType,
      );

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