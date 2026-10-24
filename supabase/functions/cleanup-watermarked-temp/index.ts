import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET_NAME = "watermarked-temp";
const EXPIRY_HOURS = 24;
const PAGE_SIZE = 100;

type ListedFile = {
  name: string;
  id: string | null;
  created_at?: string;
  path: string;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return Response.json(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function matchesSecret(
  supplied: string,
  expected: string,
): Promise<boolean> {
  const encoder = new TextEncoder();

  const [suppliedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);

  const a = new Uint8Array(suppliedHash);
  const b = new Uint8Array(expectedHash);

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |= a[i] ^ b[i];
  }

  return difference === 0;
}

async function listFilesRecursively(
  adminSupabase: ReturnType<typeof createClient>,
  folder = "",
): Promise<ListedFile[]> {
  const files: ListedFile[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await adminSupabase.storage
      .from(BUCKET_NAME)
      .list(folder, {
        limit: PAGE_SIZE,
        offset,
      });

    if (error) {
      throw new Error(
        `Unable to list temporary storage: ${error.message}`,
      );
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const item of data) {
      if (!item.name) continue;

      const path = folder
        ? `${folder}/${item.name}`
        : item.name;

      // Storage folders have no object ID. Recurse into them.
      if (!item.id) {
        files.push(
          ...(await listFilesRecursively(adminSupabase, path)),
        );
        continue;
      }

      files.push({
        name: item.name,
        id: item.id,
        created_at: item.created_at,
        path,
      });
    }

    if (data.length < PAGE_SIZE) {
      break;
    }

    offset += data.length;
  }

  return files;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed." },
      405,
    );
  }

  const expectedSecret =
    Deno.env.get("WATERMARK_CLEANUP_SECRET");

  if (!expectedSecret) {
    console.error(
      "WATERMARK_CLEANUP_SECRET is not configured.",
    );

    return jsonResponse(
      { error: "Cleanup service is not configured." },
      500,
    );
  }

  const suppliedSecret =
    req.headers.get("x-cleanup-secret") ?? "";

  if (
    !suppliedSecret ||
    !(await matchesSecret(suppliedSecret, expectedSecret))
  ) {
    return jsonResponse(
      { error: "Unauthorized." },
      401,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Required Supabase environment variables are missing.",
    );

    return jsonResponse(
      { error: "Cleanup service is not configured." },
      500,
    );
  }

  let dryRun = false;

  try {
    const body = await req.json();

    dryRun = body?.dryRun === true;
  } catch {
    // An empty request body means a normal cleanup run.
  }

  const adminSupabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const cutoffTime =
    Date.now() - EXPIRY_HOURS * 60 * 60 * 1000;

  try {
    const files = await listFilesRecursively(adminSupabase);

    const expiredFiles = files.filter((file) => {
      if (!file.created_at) return false;

      const createdAt = Date.parse(file.created_at);

      return (
        Number.isFinite(createdAt) &&
        createdAt < cutoffTime
      );
    });

    // Inspection mode: identify expired files without deleting them.
    if (dryRun) {
      return jsonResponse({
        success: true,
        dryRun: true,
        bucket: BUCKET_NAME,
        expiryHours: EXPIRY_HOURS,
        cutoff: new Date(cutoffTime).toISOString(),
        scanned: files.length,
        expired: expiredFiles.length,
        samplePaths: expiredFiles
          .slice(0, 20)
          .map((file) => file.path),
      });
    }

    let removed = 0;
    let failed = 0;

    // Delete in batches to keep individual Storage requests manageable.
    for (
      let i = 0;
      i < expiredFiles.length;
      i += PAGE_SIZE
    ) {
      const batch = expiredFiles.slice(i, i + PAGE_SIZE);

      const { data, error } = await adminSupabase.storage
        .from(BUCKET_NAME)
        .remove(batch.map((file) => file.path));

      if (error) {
        console.error(
          "Temporary file deletion failed:",
          error.message,
        );

        failed += batch.length;
        continue;
      }

      removed += data?.length ?? 0;

      if (!data || data.length !== batch.length) {
        failed += Math.max(
          0,
          batch.length - (data?.length ?? 0),
        );
      }
    }

    return jsonResponse({
      success: failed === 0,
      dryRun: false,
      bucket: BUCKET_NAME,
      expiryHours: EXPIRY_HOURS,
      cutoff: new Date(cutoffTime).toISOString(),
      scanned: files.length,
      expired: expiredFiles.length,
      removed,
      failed,
    });
  } catch (error) {
    console.error(
      "Temporary storage cleanup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse(
      { error: "Temporary storage cleanup failed." },
      500,
    );
  }
});