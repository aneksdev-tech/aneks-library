import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers":
    "Content-Disposition, Content-Type",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function getSafeFilename(filename: string) {
  return filename
    .replace(/[\r\n"]/g, "_")
    .replace(/[\\/]/g, "_");
}

function getResourceFilename(
  storedFilename: string | null,
  filePath: string,
  extension: string,
) {
  const original =
    storedFilename?.trim() ||
    filePath.split("/").pop() ||
    `resource.${extension}`;

  const withoutExtension =
    original.replace(/\.[^.]+$/, "");
    
  return `${withoutExtension || "resource"}.${extension}`;
}

function attachmentResponse(
  blob: Blob,
  contentType: string,
  filename: string,
) {
  const safeFilename = getSafeFilename(filename);
  const encodedFilename = encodeURIComponent(filename).replace(
  /['()*]/g,
  (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
);

  const contentDisposition =
    `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;

  const response = new Response(blob, {
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

  console.log("Attachment response diagnostics:", {
    filename,
    contentType,
    contentDisposition,
    actualContentDisposition: response.headers.get(
      "Content-Disposition",
    ),
    exposedHeaders: response.headers.get(
      "Access-Control-Expose-Headers",
    ),
  });

  return response;
}

async function recordDownload(
  userSupabase: ReturnType<typeof createClient>,
  userId: string,
  resourceId: string,
) {
  const { error } = await userSupabase
    .from("downloads")
    .insert({
      user_id: userId,
      resource_id: resourceId,
    });

  if (error) {
    console.error("Failed to record download:", error);
    throw new Error("Unable to record download.");
  }
}

async function downloadWatermarkedResource(
  adminSupabase: ReturnType<typeof createClient>,
  watermarkServer: string,
  watermarkSecret: string,
  filePath: string,
  type: "image" | "pdf",
) {
  const endpoint =
    `${watermarkServer.replace(/\/+$/, "")}/api/watermark`;

  let watermarkResponse: Response;

  try {
    watermarkResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Watermark-Secret": watermarkSecret,
      },
      body: JSON.stringify({
        filePath,
        type,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    console.error(
      "Watermark API request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    throw new Error("Watermark processing service is unavailable.");
  }

  if (!watermarkResponse.ok) {
    const upstreamBody = await watermarkResponse
      .text()
      .catch(() => "");

    console.error("Watermark API returned an error:", {
      endpoint,
      type,
      status: watermarkResponse.status,
      statusText: watermarkResponse.statusText,
      responseBody: upstreamBody.slice(0, 1000),
    });

    throw new Error("Unable to process the requested resource.");
  }

  let result: {
    success?: boolean;
    bucket?: string;
    path?: string;
    contentType?: string;
  };

  try {
    result = await watermarkResponse.json();
  } catch {
    throw new Error("Invalid response from watermark service.");
  }

  const allowedImageTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  const validContentType =
    type === "image"
      ? typeof result.contentType === "string" &&
        allowedImageTypes.has(result.contentType)
      : result.contentType === "application/pdf";

  if (
    result.success !== true ||
    result.bucket !== "watermarked-temp" ||
    typeof result.path !== "string" ||
    !result.path.trim() ||
    !validContentType
  ) {
    console.error("Invalid watermark response metadata:", {
      type,
      success: result.success,
      bucket: result.bucket,
      contentType: result.contentType,
    });

    throw new Error("Invalid processed resource metadata.");
  }

  const temporaryPath = result.path;
  let watermarkedBlob: Blob | null = null;
  let retrievalError: unknown = null;

  try {
    const {
      data,
      error,
    } = await adminSupabase.storage
      .from("watermarked-temp")
      .download(temporaryPath);

    if (error || !data) {
      console.error(
        "Watermarked resource retrieval failed:",
        error,
      );

      throw new Error("Unable to retrieve the processed resource.");
    }

    watermarkedBlob = data;
  } catch (error) {
    retrievalError = error;
  } finally {
    // Remove the temporary object after retrieval has finished.
    // Cleanup failures must not override the download result.
    try {
      const { error: cleanupError } = await adminSupabase.storage
        .from("watermarked-temp")
        .remove([temporaryPath]);

      if (cleanupError) {
        console.error(
          "Temporary watermark cleanup failed; scheduled cleanup remains available:",
          cleanupError.message,
        );
      }
    } catch (cleanupError) {
      console.error(
        "Temporary watermark cleanup threw an error; scheduled cleanup remains available:",
        cleanupError instanceof Error
          ? cleanupError.message
          : "Unknown error",
      );
    }
  }

  if (retrievalError || !watermarkedBlob) {
    throw retrievalError instanceof Error
      ? retrievalError
      : new Error("Unable to retrieve the processed resource.");
  }

  return {
    blob: watermarkedBlob,
    contentType: result.contentType!,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse(
        { error: "Method not allowed." },
        405,
      );
    }

    const authorization =
      req.headers.get("Authorization") ?? "";

    if (!authorization.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Unauthorized." },
        401,
      );
    }

    // Validate the caller's JWT using a user-scoped client.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !anonKey) {
      console.error("Supabase URL or anon key is not configured.");

      return jsonResponse(
        { error: "Download service is not configured." },
        500,
      );
    }

    const userSupabase = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse(
        { error: "Unauthorized." },
        401,
      );
    }

    // Create the privileged client only after authentication.
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!serviceRoleKey) {
      console.error(
        "SUPABASE_SERVICE_ROLE_KEY is not configured.",
      );

      return jsonResponse(
        { error: "Download service is not configured." },
        500,
      );
    }

    const adminSupabase = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    // Read request body.
    let body: { resourceId?: unknown };

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "Invalid request body." },
        400,
      );
    }

    const resourceId =
      typeof body.resourceId === "string"
        ? body.resourceId.trim()
        : "";

    if (!resourceId) {
      return jsonResponse(
        { error: "Missing resourceId." },
        400,
      );
    }

    // Verify the caller's account.
    const {
      data: profile,
      error: profileError,
    } = await adminSupabase
      .from("profiles")
      .select("primary_role, subscription_plan, status")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(
        "Failed to load user profile:",
        profileError,
      );

      return jsonResponse(
        { error: "Unable to verify account access." },
        500,
      );
    }

    if (profile.status !== "active") {
      return jsonResponse(
        { error: "Your account is not active." },
        403,
      );
    }

    const isAdmin =
      profile.primary_role === "admin" ||
      profile.primary_role === "co-admin";

    const isPremium =
      profile.subscription_plan === "premium";

    // Preserve the existing rule: admin, co-admin, or premium.
    if (!isAdmin && !isPremium) {
      return jsonResponse(
        { error: "Premium subscription required." },
        403,
      );
    }

    // Retrieve only active, approved resources.
    const {
      data: resource,
      error: resourceError,
    } = await adminSupabase
      .from("resources")
      .select("id, file_path, file_name, mime_type")
      .eq("id", resourceId)
      .eq("status", "approved")
      .is("deleted_at", null)
      .single();

    if (resourceError || !resource) {
      console.error(
        "Resource lookup failed:",
        resourceError,
      );

      return jsonResponse(
        {
          error:
            "Resource not found or is not available for download.",
        },
        404,
      );
    }

    // Detect the resource type from its stored path.
    const extension =
      resource.file_path
        .split(".")
        .pop()
        ?.toLowerCase() ?? "";

    const imageExtensions = new Set([
      "jpg",
      "jpeg",
      "png",
      "webp",
    ]);

    const isImage = imageExtensions.has(extension);
    const isPdf = extension === "pdf";
    const isDocx = extension === "docx";

    // Watermark configuration is required only for images and PDFs.
    const watermarkServer =
      Deno.env.get("WATERMARK_SERVER")?.trim();

    const watermarkSecret =
      Deno.env.get("WATERMARK_SERVER_SECRET");

    // -------------------------------------------------
    // Images and PDFs: watermark through Vercel.
    // -------------------------------------------------

    if (isImage || isPdf) {
      if (!watermarkServer || !watermarkSecret) {
        console.error(
          "Watermark server configuration is incomplete.",
        );

        return jsonResponse(
          { error: "Watermark service is not configured." },
          500,
        );
      }

      const type = isImage ? "image" : "pdf";

      const {
        blob,
        contentType,
      } = await downloadWatermarkedResource(
        adminSupabase,
        watermarkServer,
        watermarkSecret,
        resource.file_path,
        type,
      );

      const outputExtension =
        contentType === "application/pdf"
          ? "pdf"
          : contentType === "image/png"
            ? "png"
            : contentType === "image/webp"
              ? "webp"
              : "jpg";
              
      console.log("Download filename diagnostics:", {
          resourceId: resource.id,
          storedFilename: resource.file_name,
          storedPath: resource.file_path,
          outputExtension,
      });

      const filename = getResourceFilename(
        resource.file_name,
        resource.file_path,
        outputExtension,
      );
      
      console.log("Generated download filename:", filename);

// Record only after processing and retrieval succeed.
      await recordDownload(
        userSupabase,
        user.id,
        resource.id,
      );

      return attachmentResponse(
        blob,
        contentType,
        filename,
      );
    }

    // -------------------------------------------------
    // DOCX: download the original Word document.
    // -------------------------------------------------

    if (isDocx) {
      const {
        data: originalBlob,
        error: storageError,
      } = await adminSupabase.storage
        .from("resources")
        .download(resource.file_path);

      if (storageError || !originalBlob) {
        console.error(
          "Original DOCX download failed:",
          storageError,
        );

        return jsonResponse(
          { error: "Unable to retrieve Word document." },
          500,
        );
      }

      await recordDownload(
        userSupabase,
        user.id,
        resource.id,
      );

      const filename = getResourceFilename(
        resource.file_name,
        resource.file_path,
        "docx",
      );

      return attachmentResponse(
        originalBlob,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename,
      );
    }

    // -------------------------------------------------
    // Other file types: return a short-lived signed URL.
    // -------------------------------------------------

    const {
      data: signed,
      error: signedError,
    } = await adminSupabase.storage
      .from("resources")
      .createSignedUrl(
        resource.file_path,
        60,
      );

    if (signedError || !signed) {
      console.error(
        "Signed URL generation failed:",
        signedError,
      );

      return jsonResponse(
        { error: "Unable to generate download link." },
        500,
      );
    }

    await recordDownload(
      userSupabase,
      user.id,
      resource.id,
    );

    return jsonResponse({
      url: signed.signedUrl,
    });
  } catch (error) {
    console.error(
      "Download resource request failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    if (
      error instanceof Error &&
      error.message === "Unable to record download."
    ) {
      return jsonResponse(
        { error: "Unable to record download." },
        500,
      );
    }

    if (
      error instanceof Error &&
      error.message === "Resource not found or is not available for download."
    ) {
      return jsonResponse(
        { error: error.message },
        404,
      );
    }

    if (
      error instanceof Error &&
      (
        error.message.toLowerCase().includes("damaged") ||
        error.message.toLowerCase().includes("unsupported")
      )
    ) {
      return jsonResponse(
        { error: error.message },
        400,
      );
    }

    return jsonResponse(
      { error: "Unable to download this resource right now." },
      500,
    );
  }
});