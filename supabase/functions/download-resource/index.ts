import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

  async function downloadStorageFile(
  supabase: ReturnType<typeof createClient>,
  filePath: string,
) {
  const { data, error } =
    await supabase.storage
      .from("resources")
      .download(filePath);

  if (error || !data) {
    throw new Error(
      "Unable to download original image.",
    );
  }

  return data;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    // Create Supabase client using the user's JWT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization") ?? "",
          },
        },
      }
    );

    // Get logged-in user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { error: "Unauthorized." },
        {
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    // Read request body
    const { resourceId } = await req.json();

    if (!resourceId) {
      return Response.json(
        { error: "Missing resourceId." },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Check user's access
const premiumResult = await supabase.rpc("is_premium", {
  _user: user.id,
});

console.log(
  "Premium:",
  premiumResult.data,
);

const adminResult = await supabase.rpc("is_admin", {
  _user_id: user.id,
});

console.log(
  "Admin:",
  adminResult.data,
);

if (premiumResult.error) {
  return Response.json(
    {
      error: premiumResult.error.message,
    },
    {
      status: 500,
      headers: corsHeaders,
    }
  );
}

if (adminResult.error) {
  return Response.json(
    {
      error: adminResult.error.message,
    },
    {
      status: 500,
      headers: corsHeaders,
    }
  );
}

const premium = Boolean(premiumResult.data);
const admin = Boolean(adminResult.data);

    // Only Premium or Admin can download
    if (!premium && !admin) {
      return Response.json(
        {
          error: "Premium subscription required.",
        },
        {
          status: 403,
          headers: corsHeaders,
        }
      );
    }

    // Find the resource
    const { data: resource, error: resourceError } = await supabase
      .from("resources")
      .select("id, file_path")
      .eq("id", resourceId)
      .single();

    if (resourceError || !resource) {
      return Response.json(
        {
          error: "Resource not found.",
        },
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    // Log the download
    const { error: downloadError } = await supabase
      .from("downloads")
      .insert({
        user_id: user.id,
        resource_id: resource.id,
      });

    if (downloadError) {
      console.error(downloadError);

      return Response.json(
        {
          error: "Unable to record download.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

// ---------------------------------------
// Image Detection
// ---------------------------------------

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

const isImage =
  imageExtensions.has(extension);

const isPdf =
  extension === "pdf";

const isDocx =
  extension === "docx";

if (isImage) {
  const originalBlob =
    await downloadStorageFile(
      supabase,
      resource.file_path,
    );

  const bytes = new Uint8Array(
    await originalBlob.arrayBuffer(),
  );

  const base64 = btoa(
  Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("")
);

  console.log(
    "Sending image to watermark server...",
  );

  const watermarkServer =
  Deno.env.get("WATERMARK_SERVER");

if (!watermarkServer) {
  throw new Error(
    "WATERMARK_SERVER secret is not configured.",
  );
}

const response = await fetch(
  `${watermarkServer}/watermark`,
  {
    method: "POST",
    headers: {
      "Content-Type":
        "application/json",
    },
    body: JSON.stringify({
      image: base64,
    }),
  },
);

if (!response.ok) {
  throw new Error(
    "Watermark server failed.",
  );
}

const watermarkedImage =
  await response.arrayBuffer();

console.log(
  "Watermark applied successfully.",
);

return new Response(watermarkedImage, {
  headers: {
    ...corsHeaders,
    "Content-Type": "image/jpeg",
    "Content-Disposition": `inline; filename="${resource.file_path
      .split("/")
      .pop()}"`,
    "Cache-Control": "private, max-age=60",
  },
});
}

// ---------------------------------------
// PDF Watermark
// ---------------------------------------

if (isPdf) {

  const originalBlob =
    await downloadStorageFile(
      supabase,
      resource.file_path,
    );

  const bytes =
    new Uint8Array(
      await originalBlob.arrayBuffer(),
    );

  const base64 =
    btoa(
      Array.from(bytes)
        .map((b) =>
          String.fromCharCode(b),
        )
        .join(""),
    );

  const watermarkServer =
    Deno.env.get(
      "WATERMARK_SERVER",
    );

  if (!watermarkServer) {
    throw new Error(
      "WATERMARK_SERVER secret is not configured.",
    );
  }

  console.log(
    "Sending PDF to watermark server...",
  );

  const response =
    await fetch(
      `${watermarkServer}/watermark-pdf`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({

          pdf: base64,

          email: user.email,

        }),

      },
    );

  if (!response.ok) {

    throw new Error(
      "PDF watermark server failed.",
    );

  }

  const watermarkedPdf =
    await response.arrayBuffer();

  console.log(
    "PDF watermark applied successfully.",
  );

  return new Response(
    watermarkedPdf,
    {
      headers: {

        ...corsHeaders,

        "Content-Type":
          "application/pdf",

        "Content-Disposition":
          `inline; filename="${
            resource.file_path
              .split("/")
              .pop()
          }"`,

        "Cache-Control":
          "private, max-age=60",

      },
    },
  );
}

// ---------------------------------------
// DOCX Watermark
// ---------------------------------------

if (isDocx) {

  const originalBlob =
    await downloadStorageFile(
      supabase,
      resource.file_path,
    );

  const bytes =
    new Uint8Array(
      await originalBlob.arrayBuffer(),
    );

  const base64 =
    btoa(
      Array.from(bytes)
        .map((b) =>
          String.fromCharCode(b),
        )
        .join(""),
    );

  const watermarkServer =
    Deno.env.get(
      "WATERMARK_SERVER",
    );

  if (!watermarkServer) {
    throw new Error(
      "WATERMARK_SERVER secret is not configured.",
    );
  }

  console.log(
    "Sending DOCX to watermark server...",
  );

  const response =
    await fetch(
      `${watermarkServer}/watermark-docx`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({

          docx: base64,

          email: user.email,

        }),

      },
    );

  if (!response.ok) {

  let message =
    "DOCX watermark server failed.";

  try {

    const body =
      await response.json();

    if (
      body &&
      typeof body.error === "string"
    ) {
      message = body.error;
    }

  } catch {

    // Ignore invalid JSON responses

  }

  console.log(
    "DOCX server response:",
    message,
  );

  throw new Error(message);

}

  const pdf =
    await response.arrayBuffer();

  console.log(
    "DOCX converted and watermarked.",
  );

  return new Response(
    pdf,
    {
      headers: {

        ...corsHeaders,

        "Content-Type":
          "application/pdf",

        "Content-Disposition":
          `inline; filename="${
            resource.file_path
              .replace(/\.docx$/i, ".pdf")
              .split("/")
              .pop()
          }"`,

        "Cache-Control":
          "private, max-age=60",

      },
    },
  );
}

    // Generate signed URL
    const { data: signed, error: signedError } =
      await supabase.storage
        .from("resources")
        .createSignedUrl(resource.file_path, 60);

    if (signedError || !signed) {
      console.error(signedError);

      return Response.json(
        {
          error: "Unable to generate download link.",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    return Response.json(
      {
        url: signed.signedUrl,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (err) {

  console.dir(err, {
  depth: null,
});

  const message =
    err instanceof Error
      ? err.message
      : String(err);

  const status =
    message.includes("damaged") ||
    message.includes("unsupported")
      ? 400
      : 500;

  return Response.json(
    {
      error: message,
    },
    {
      status,
      headers: corsHeaders,
    }
  );

}

});