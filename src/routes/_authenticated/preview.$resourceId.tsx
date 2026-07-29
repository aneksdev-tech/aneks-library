import { createFileRoute, Link, } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DocumentPreview } from "@/components/document-preview/DocumentPreview";
import {
  BookOpen,
  Building2,
  GraduationCap,
  CalendarDays,
  School,
  Download,
  Loader2,
} from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { downloadResource } from "@/lib/download";

export const Route = createFileRoute(
  "/_authenticated/preview/$resourceId",
)({
  component: PreviewPage,
});

function PreviewPage() {
  const { resourceId } = Route.useParams();

  const { user } = useAuth();

const queryClient = useQueryClient();

const [upgradeOpen, setUpgradeOpen] =
  useState(false);

const [downloading, setDownloading] =
  useState(false);

  const { data: resource, isLoading } = useQuery({
    queryKey: ["preview", resourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select(`
          *,
          category:categories(name),
          uploader:profiles!resources_uploader_id_fkey(
          id,
          full_name,
          bio,
          avatar_url
      )
      `)
        .eq("id", resourceId)
        .single();

      if (error) {
      console.error(error);
      throw error;
  }
      console.log("Uploader:", (data as any).uploader);

      return data;
    },
  });

  const { data: previewUrl } = useQuery({
    queryKey: ["preview-url", resourceId],
    enabled: !!resource,
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      return {
        url:
          `${import.meta.env.VITE_SUPABASE_URL}` +
          `/functions/v1/preview-resource?resourceId=${resource!.id}`,
        accessToken: session?.access_token ?? "",
      };
    },
  });

  const { data: isPremium = false } = useQuery({
  queryKey: ["is-premium", user?.id],
  enabled: !!user,
  queryFn: async () => {
    const { data, error } =
      await supabase.rpc("is_premium", {
        _user: user!.id,
      });

    if (error) throw error;

    return Boolean(data);
  },
});

const { data: isAdmin = false } = useQuery({
  queryKey: ["is-admin", user?.id],
  enabled: !!user,
  queryFn: async () => {
    const { data, error } =
      await supabase.rpc("is_admin", {
        _user_id: user!.id,
      });

    if (error) throw error;

    return Boolean(data);
  },
});

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        Resource not found.
      </div>
    );
  }

  const collegeShort =
  resource.college?.match(/\((.*?)\)/)?.[1] ?? resource.college;

// Tell TypeScript about the joined uploader object
const uploader = (resource as typeof resource & {
  uploader?: {
    id: string;
    full_name: string | null;
    bio: string | null;
    avatar_url: string | null;
  } | null;
}).uploader;
  
  const download = async () => {
  if (downloading) return;

  if (!user) {
    toast.error("Sign in to download");
    return;
  }

  if (!isAdmin && !isPremium) {
    setUpgradeOpen(true);
    return;
  }

  setDownloading(true);

  try {
    await downloadResource(resource.id);

    queryClient.invalidateQueries({
      queryKey: ["library"],
    });
  } catch (err: any) {
    toast.error(err.message);
  } finally {
    setDownloading(false);
  }
};

  return (
  <>
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <button
          onClick={() => window.history.back()}
          className="mb-4 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ← Back
        </button>

        <div className="mb-4 flex flex-wrap gap-2">
          {resource.category?.name && (
            <span className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {resource.category.name}
            </span>
          )}
        </div>

        <h1 className="font-display text-3xl font-semibold">
          {resource.title}
        </h1>

        {resource.description && (
          <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
            {resource.description}
          </p>
        )}

        <div className="mt-6 grid gap-3 text-sm">
          {resource.course_code && (
            <div className="flex items-center gap-3">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>{resource.course_code}</span>
            </div>
          )}

          {resource.college && (
            <div className="flex items-center gap-3">
              <School className="h-4 w-4 text-primary" />
              <span>{collegeShort}</span>
            </div>
          )}

          {resource.department && (
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{resource.department}</span>
            </div>
          )}

          {resource.level && (
            <div className="flex items-center gap-3">
              <GraduationCap className="h-4 w-4 text-primary" />
              <span>{resource.level}</span>
            </div>
          )}

          {resource.semester && (
            <div className="flex items-center gap-3">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span>{resource.semester}</span>
            </div>
          )}

          <div className="pt-2">
  <div className="mb-3 text-sm font-medium text-muted-foreground">
    Uploaded by
  </div>

  <Link
  to="/profile/$userId"
  params={{
    userId: uploader?.id ?? "",
  }}
  className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted/40"
>
    {uploader?.avatar_url ? (
      <img
        src={uploader.avatar_url}
        alt={uploader.full_name ?? "Uploader"}
        className="h-12 w-12 rounded-full border object-cover"
      />
    ) : (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted text-lg font-semibold">
        {(() => {
  const parts =
    (uploader?.full_name ?? "?")
      .trim()
      .split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0][0] +
    parts[1][0]
  ).toUpperCase();
})()}
      </div>
    )}

    <div>
      <div className="font-medium">
        {uploader?.full_name ?? "Unknown user"}
      </div>

      {uploader?.bio && (
        <div className="text-sm text-muted-foreground">
          {uploader.bio}
        </div>
      )}
    </div>
  </Link>

  <div className="mt-4 text-sm text-muted-foreground">
    Uploaded on{" "}
    {new Date(resource.created_at).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}
  </div>
</div>

          <div className="pt-2 max-w-sm">
  <Button
  className="w-full bg-gradient-emerald"
    onClick={download}
    disabled={downloading}  
  >
    {downloading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Preparing Download...
      </>
    ) : (
      <>
        <Download className="mr-2 h-4 w-4" />
        Download
      </>
    )}
  </Button>
</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        {previewUrl ? (
          <DocumentPreview
            url={previewUrl.url}
            token={previewUrl.accessToken}
            filePath={resource.file_path}
            title={resource.title}
          />
        ) : (
          <div className="flex h-[70vh] items-center justify-center">
            Preparing preview...
          </div>
        )}
      </div>
        </div>

    <UpgradeDialog
      open={upgradeOpen}
      onOpenChange={setUpgradeOpen}
    />
  </>
  );
}