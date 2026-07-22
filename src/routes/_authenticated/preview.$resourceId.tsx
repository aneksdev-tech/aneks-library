import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DocumentPreview } from "@/components/document-preview/DocumentPreview";

export const Route = createFileRoute(
  "/_authenticated/preview/$resourceId",
)({
  component: PreviewPage,
});

function PreviewPage() {
  const { resourceId } = Route.useParams();

  const { data: resource, isLoading } = useQuery({
    queryKey: ["preview", resourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select(`
          *,
          category:categories(name)
        `)
        .eq("id", resourceId)
        .single();

      if (error) throw error;

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

  return (
  <div className="mx-auto max-w-6xl space-y-8">
    <div>

      <button
        onClick={() => window.history.back()}
        className="
          mb-4
          inline-flex
          items-center
          text-sm
          font-medium
          text-muted-foreground
          transition-colors
          hover:text-primary
        "
      >
        ← Back
      </button>

      <h1 className="font-display text-3xl font-semibold">
        {resource.title}
      </h1>

      {resource.description && (
        <p className="mt-3 max-w-3xl text-muted-foreground">
          {resource.description}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {resource.course_code && (
          <span className="rounded-md bg-muted px-3 py-1 text-sm">
            {resource.course_code}
          </span>
        )}

        {resource.department && (
          <span className="rounded-md bg-muted px-3 py-1 text-sm">
            {resource.department}
          </span>
        )}

        {resource.year && (
          <span className="rounded-md bg-muted px-3 py-1 text-sm">
            {resource.year}
          </span>
        )}

        {resource.category?.name && (
          <span className="rounded-md bg-primary/10 px-3 py-1 text-sm text-primary">
            {resource.category.name}
          </span>
        )}
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
);
}