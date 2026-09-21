import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    // -------------------------------------------------
    // User-scoped client
    // Used only to validate the caller's JWT.
    // -------------------------------------------------

    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
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

    // -------------------------------------------------
    // Privileged server client
    //
    // IMPORTANT:
    // This client is only used AFTER the caller has
    // successfully authenticated and passed the
    // application-level authorization checks below.
    // -------------------------------------------------

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!serviceRoleKey) {
      console.error(
        "SUPABASE_SERVICE_ROLE_KEY is not configured.",
      );

      return jsonResponse(
        {
          error:
            "Download service is not configured.",
        },
        500,
      );
    }

    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
    );

    // -------------------------------------------------
    // Read request body
    // -------------------------------------------------

    let body: { resourceId?: string };

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

    // -------------------------------------------------
    // Load caller profile
    // -------------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await adminSupabase
      .from("profiles")
      .select(
        "primary_role, subscription_plan, status",
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(
        "Failed to load user profile:",
        profileError,
      );

      return jsonResponse(
        {
          error:
            "Unable to verify account access.",
        },
        500,
      );
    }

    if (profile.status !== "active") {
      return jsonResponse(
        {
          error:
            "Your account is not active.",
        },
        403,
      );
    }

    const isAdmin =
      profile.primary_role === "admin" ||
      profile.primary_role === "co-admin";

    const isPremium =
      profile.subscription_plan === "premium";

    // -------------------------------------------------
    // Download authorization
    //
    // Preserve current business rule:
    // Admin + Co-admin + Premium
    // -------------------------------------------------

    if (!isAdmin && !isPremium) {
      return jsonResponse(
        {
          error:
            "Premium subscription required.",
        },
        403,
      );
    }

    // -------------------------------------------------
    // Find ONLY an active approved resource
    // -------------------------------------------------

    const {
      data: resource,
      error: resourceError,
    } = await adminSupabase
      .from("resources")
      .select(
        "id, file_path, file_name, mime_type",
      )
      .eq("id", resourceId)
      .eq(
        "status",
        "approved",
      )
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

    // -------------------------------------------------
    // File type detection
    // -------------------------------------------------

    const extension =
      resource.file_path
        .split(".")
        .pop()
        ?.toLowerCase() ?? "";

    const imageExtensions =
      new Set([
        "jpg",
        "jpeg",
        "png",
        "webp",
      ]);

    const isImage =
      imageExtensions.has(extension);

    const isPdf =
      extension === "pdf";

    const isDocx =
      extension === "docx";

    // -------------------------------------------------
    // Watermark server configuration
    // -------------------------------------------------

    const watermarkServer =
      Deno.env.get("WATERMARK_SERVER");

    const watermarkSecret =
      Deno.env.get(
        "WATERMARK_SERVER_SECRET",
      );

    // -------------------------------------------------
    // Images
    //
    // Retrieve the private Storage object with the
    // service-role client, then send it to the
    // authenticated watermark server.
    // -------------------------------------------------

    if (isImage) {
      if (!watermarkServer) {
        throw new Error(
          "WATERMARK_SERVER secret is not configured.",
        );
      }

      if (!watermarkSecret) {
        throw new Error(
          "WATERMARK_SERVER_SECRET is not configured.",
        );
      }

      const {
        data: originalBlob,
        error: storageError,
      } = await adminSupabase.storage
        .from("resources")
        .download(resource.file_path);

      if (
        storageError ||
        !originalBlob
      ) {
        console.error(
          "Image Storage download failed:",
          storageError,
        );

        return jsonResponse(
          {
            error:
              "Unable to retrieve resource.",
          },
          500,
        );
      }

      const bytes =
        new Uint8Array(
          await originalBlob.arrayBuffer(),
        );

      let binary = "";

      const chunkSize = 0x8000;

      for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
      ) {
        binary += String.fromCharCode(
          ...bytes.subarray(
            i,
            Math.min(
              i + chunkSize,
              bytes.length,
            ),
          ),
        );
      }

      const base64 =
        btoa(binary);

      const response =
        await fetch(
          `${watermarkServer}/watermark`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "X-Watermark-Secret":
                watermarkSecret,
            },
            body: JSON.stringify({
              image: base64,
            }),
          },
        );

      if (!response.ok) {
        let message =
          "Watermark server failed.";

        try {
          const result =
            await response.json();

          if (
            result &&
            typeof result.error ===
              "string"
          ) {
            message = result.error;
          }
        } catch {
          // Ignore invalid JSON.
        }

        throw new Error(message);
      }

      const watermarkedImage =
        await response.arrayBuffer();

      // -------------------------------------------------
      // Record successful download
      // -------------------------------------------------

      const {
        error: downloadError,
      } = await adminSupabase
        .from("downloads")
        .insert({
          user_id: user.id,
          resource_id: resource.id,
        });

      if (downloadError) {
        console.error(
          "Failed to record download:",
          downloadError,
        );

        return jsonResponse(
          {
            error:
              "Unable to record download.",
          },
          500,
        );
      }

      return new Response(
        watermarkedImage,
        {
          headers: {
            ...corsHeaders,
            "Content-Type":
              "image/jpeg",
            "Content-Disposition":
              `inline; filename="${resource.file_name ?? resource.file_path.split("/").pop() ?? "resource.jpg"}"`,
            "Cache-Control":
              "private, max-age=60",
          },
        },
      );
    }

    // -------------------------------------------------
    // PDF
    // -------------------------------------------------

    if (isPdf) {
      if (!watermarkServer) {
        throw new Error(
          "WATERMARK_SERVER is not configured.",
        );
      }

      if (!watermarkSecret) {
        throw new Error(
          "WATERMARK_SERVER_SECRET is not configured.",
        );
      }

      const response =
        await fetch(
          `${watermarkServer}/watermark-pdf`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "X-Watermark-Secret":
                watermarkSecret,
            },
            body: JSON.stringify({
              filePath: resource.file_path,
            }),
          },
        );

      if (!response.ok) {
        let message =
          "PDF watermark server failed.";

        try {
          const result =
            await response.json();

          if (
            result &&
            typeof result.error ===
              "string"
          ) {
            message = result.error;
          }
        } catch {
          // Ignore invalid JSON.
        }

        throw new Error(message);
      }

      const watermarkedPdf =
        await response.arrayBuffer();

      // -------------------------------------------------
      // Record successful download
      // -------------------------------------------------

      const {
        error: downloadError,
      } = await adminSupabase
        .from("downloads")
        .insert({
          user_id: user.id,
          resource_id: resource.id,
        });

      if (downloadError) {
        console.error(
          "Failed to record download:",
          downloadError,
        );

        return jsonResponse(
          {
            error:
              "Unable to record download.",
          },
          500,
        );
      }

      return new Response(
        watermarkedPdf,
        {
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/pdf",
            "Content-Disposition":
              `inline; filename="${resource.file_name ?? resource.file_path.split("/").pop() ?? "resource.pdf"}"`,
            "Cache-Control":
              "private, max-age=60",
          },
        },
      );
    }

    // -------------------------------------------------
    // DOCX
    // -------------------------------------------------

    if (isDocx) {
      if (!watermarkServer) {
        throw new Error(
          "WATERMARK_SERVER is not configured.",
        );
      }

      if (!watermarkSecret) {
        throw new Error(
          "WATERMARK_SERVER_SECRET is not configured.",
        );
      }

      const response =
        await fetch(
          `${watermarkServer}/watermark-docx`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "X-Watermark-Secret":
                watermarkSecret,
            },
            body: JSON.stringify({
              filePath: resource.file_path,
            }),
          },
        );

      if (!response.ok) {
        let message =
          "DOCX watermark server failed.";

        try {
          const result =
            await response.json();

          if (
            result &&
            typeof result.error ===
              "string"
          ) {
            message = result.error;
          }
        } catch {
          // Ignore invalid JSON.
        }

        throw new Error(message);
      }

      const watermarkedPdf =
        await response.arrayBuffer();

      // -------------------------------------------------
      // Record successful download
      // -------------------------------------------------

      const {
        error: downloadError,
      } = await adminSupabase
        .from("downloads")
        .insert({
          user_id: user.id,
          resource_id: resource.id,
        });

      if (downloadError) {
        console.error(
          "Failed to record download:",
          downloadError,
        );

        return jsonResponse(
          {
            error:
              "Unable to record download.",
          },
          500,
        );
      }

      return new Response(
        watermarkedPdf,
        {
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/pdf",
            "Content-Disposition":
              `inline; filename="${resource.file_name?.replace(/\.docx$/i, ".pdf") ?? resource.file_path.replace(/\.docx$/i, ".pdf").split("/").pop() ?? "resource.pdf"}"`,
            "Cache-Control":
              "private, max-age=60",
          },
        },
      );
    }

    // -------------------------------------------------
    // Other files
    //
    // Generate a short-lived signed URL using
    // the privileged client.
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

    if (
      signedError ||
      !signed
    ) {
      console.error(
        "Signed URL generation failed:",
        signedError,
      );

      return jsonResponse(
        {
          error:
            "Unable to generate download link.",
        },
        500,
      );
    }

    // -------------------------------------------------
    // Record successful download
    // -------------------------------------------------

    const {
      error: downloadError,
    } = await adminSupabase
      .from("downloads")
      .insert({
        user_id: user.id,
        resource_id: resource.id,
      });

    if (downloadError) {
      console.error(
        "Failed to record download:",
        downloadError,
      );

      return jsonResponse(
        {
          error:
            "Unable to record download.",
        },
        500,
      );
    }

    return jsonResponse({
      url: signed.signedUrl,
    });
  } catch (err) {
    console.error(err);

    const message =
      err instanceof Error
        ? err.message
        : String(err);

    const status =
      message.includes("damaged") ||
      message.includes("unsupported")
        ? 400
        : 500;

    return jsonResponse(
      {
        error: message,
      },
      status,
    );
  }
});