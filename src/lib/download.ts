import { supabase } from "@/integrations/supabase/client";

export async function downloadResource(resourceId: string) {
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
    body: JSON.stringify({
      resourceId,
    }),
  });

  if (!response.ok) {

    const contentType =
      response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {

      const result =
        await response.json();

      throw new Error(
        result.error ??
        "Download failed.",
      );

    }

    throw new Error(
      "Download failed.",
    );

  }

  const contentType =
    response.headers.get("content-type") ?? "";

  // ---------------------------------------
  // Protected files (images + PDFs)
  // ---------------------------------------

  if (
    contentType.startsWith("image/") ||
    contentType === "application/pdf"
  ) {

    const blob =
      await response.blob();

    const objectUrl =
      URL.createObjectURL(blob);

    window.open(
      objectUrl,
      "_blank",
      "noopener,noreferrer",
    );

    return;

  }

  // ---------------------------------------
  // Other files (signed URL)
  // ---------------------------------------

  const result =
    await response.json();

  window.open(
    result.url,
    "_blank",
    "noopener,noreferrer",
  );

}