import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const jwt = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("Supabase environment variables are not configured.");
    }

    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        },
      },
    );

    const serviceClient = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const {
      data: {
        user,
      },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const {
      resourceId,
      deletionReason,
    } = await req.json();

    if (
      typeof resourceId !== "string" ||
      !resourceId.trim()
    ) {
      return new Response(
        JSON.stringify({
          error: "A valid resourceId is required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /*
     * A deletion reason is mandatory.
     *
     * Normalize the value before it reaches the database so that
     * null, undefined, non-string values, and whitespace-only
     * strings cannot be used to bypass the requirement.
     */
    const normalizedDeletionReason =
      typeof deletionReason === "string"
        ? deletionReason.trim()
        : "";

    if (!normalizedDeletionReason) {
      return new Response(
        JSON.stringify({
          error: "A deletion reason is required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /*
     * Authorization is deliberately restricted to Admin and Co-admin.
     * Lecturer and Staff must not be able to delete resources.
     */
    const { data: profile, error: profileError } =
      await serviceClient
        .from("profiles")
        .select("id, primary_role, status")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({
          error: "User profile could not be verified.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (
      profile.status !== "active" ||
      !["admin", "co-admin"].includes(profile.primary_role)
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Only active Admins and Co-admins can delete resources.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { data: resource, error: resourceError } =
      await serviceClient
        .from("resources")
        .select(
          "id, title, file_path, thumbnail_path, status, deleted_at",
        )
        .eq("id", resourceId)
        .single();

    if (resourceError || !resource) {
      return new Response(
        JSON.stringify({
          error: "Resource not found.",
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (resource.status === "deleted" || resource.deleted_at) {
      return new Response(
        JSON.stringify({
          error: "This resource is already deleted.",
        }),
        {
          status: 409,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /*
     * IMPORTANT:
     *
     * Mark the database record deleted FIRST.
     *
     * This immediately makes the resource unavailable to the
     * preview/download gateways.
     */
    const deletedAt = new Date().toISOString();

    const { error: databaseError } = await userClient
      .from("resources")
      .update({
        status: "deleted",
        file_size: 0,
        deleted_by: user.id,
        deleted_at: deletedAt,
        deletion_reason: normalizedDeletionReason,
      })
      .eq("id", resource.id)
      .neq("status", "deleted");

    if (databaseError) {
      throw new Error(
        `Could not mark the resource as deleted: ${databaseError.message}`,
      );
    }

    /*
     * Remove the physical resource file after the DB record has
     * been safely invalidated.
     */
    const storageCleanupErrors: string[] = [];

    if (resource.file_path) {
      const { error } = await serviceClient.storage
        .from("resources")
        .remove([resource.file_path]);

      if (error) {
        storageCleanupErrors.push(
          `Resource file: ${error.message}`,
        );
      }
    }

    if (resource.thumbnail_path) {
      const { error } = await serviceClient.storage
        .from("thumbnails")
        .remove([resource.thumbnail_path]);

      if (error) {
        storageCleanupErrors.push(
          `Thumbnail: ${error.message}`,
        );
      }
    }

    if (storageCleanupErrors.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          status: "deleted",
          storageCleanup: "partial_failure",
          warning:
            "The resource was marked deleted, but one or more physical Storage objects could not be removed.",
          cleanupErrors: storageCleanupErrors,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "deleted",
        storageCleanup: "completed",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("delete-resource error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});