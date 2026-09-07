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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    /*
     * User-scoped client.
     *
     * Used for authentication, profile authorization, and resource metadata.
     * The user's JWT remains the authorization boundary.
     */
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization") ?? "",
          },
        },
      },
    );

    /*
     * Service-role client.
     *
     * Used ONLY after authorization has succeeded to read the private
     * Storage object. This prevents the resources bucket from becoming
     * publicly readable.
     */
    const serviceSupabase = createClient(
      supabaseUrl,
      serviceRoleKey,
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

    /*
     * Load the user's current profile so pending-resource preview
     * follows the same active-role authority used by approvals.
     */
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("primary_role, status")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(profileError);

      return Response.json(
        {
          error: "Unable to verify account authorization.",
        },
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    if (profile.status !== "active") {
      return Response.json(
        {
          error: "Your account is not active.",
        },
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    const { data: resource, error: resourceError } = await supabase
      .from("resources")
      .select("id, file_path, status, deleted_at")
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

    /*
     * Preview authorization:
     *
     * APPROVED
     *   Any authenticated active user may preview.
     *
     * PENDING
     *   Only active platform/content authorities may preview:
     *   Admin, Co-admin, Lecturer, Staff.
     *
     * DRAFT / REJECTED / DELETED
     *   Cannot be previewed.
     */
    if (resource.status === "pending") {
      const canPreviewPending =
        profile.primary_role === "admin" ||
        profile.primary_role === "co-admin" ||
        profile.primary_role === "lecturer" ||
        profile.primary_role === "staff";

      if (!canPreviewPending) {
        return Response.json(
          {
            error: "You are not authorized to preview this resource.",
          },
          {
            status: 403,
            headers: corsHeaders,
          },
        );
      }
    } else if (
      resource.status !== "approved" ||
      resource.deleted_at !== null
    ) {
      return Response.json(
        {
          error: "This resource is not available for preview.",
        },
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    /*
     * The resources bucket remains private.
     *
     * Only the service-role client reads the Storage object, and only
     * after the user's authorization has been established above.
     */
    const { data: file, error: fileError } =
      await serviceSupabase.storage
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
        "Content-Type": file.type || "application/octet-stream",
        "Content-Disposition": 'inline; filename="preview"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});