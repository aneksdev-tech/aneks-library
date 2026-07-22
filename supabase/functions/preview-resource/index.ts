import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);

    const resourceId = url.searchParams.get("resourceId");

    if (!resourceId) {
      return Response.json(
        {
          error: "Missing resourceId.",
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization:
              req.headers.get("Authorization") ?? "",
          },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        {
          error: "Unauthorized.",
        },
        {
          status: 401,
          headers: corsHeaders,
        },
      );
    }

    const { data: resource, error: resourceError } =
      await supabase
        .from("resources")
        .select("file_path")
        .eq("id", resourceId)
        .single();

    if (resourceError || !resource) {
      console.error(resourceError);

      return Response.json(
        {
          error: "Resource not found.",
        },
        {
          status: 404,
          headers: corsHeaders,
        },
      );
    }

    const { data: file, error: fileError } =
      await supabase.storage
        .from("resources")
        .download(resource.file_path);

    if (fileError || !file) {
      console.error(fileError);

      return Response.json(
        {
          error: "Unable to load preview.",
        },
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    return new Response(file.stream(), {
      headers: {
        ...corsHeaders,
        "Content-Type":
          file.type || "application/octet-stream",
        "Content-Disposition":
          'inline; filename="preview"',
        "Cache-Control":
          "private, no-store",
        "X-Content-Type-Options":
          "nosniff",
      },
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : String(err),
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});