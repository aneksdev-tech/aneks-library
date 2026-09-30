import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Megaphone,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute(
  "/_authenticated/announcements/$announcementId",
)({
  head: () => ({
    meta: [
      { title: "Announcement | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnnouncementDetailsPage,
});

function AnnouncementDetailsPage() {
  const { announcementId } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["announcement", announcementId],
    queryFn: async () => {
      const { data: announcement, error: announcementError } =
        await supabase
          .from("announcements")
          .select(
            "id, title, body, content, link, is_active, deleted_at",
          )
          .eq("id", announcementId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .maybeSingle();

      if (announcementError) {
        throw announcementError;
      }

      return announcement;
    },
  });

  if (isLoading) {
    return (
      <section className="grid min-h-[40vh] place-items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading announcement…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="grid min-h-[40vh] place-items-center">
        <div className="max-w-md text-center">
          <Megaphone className="mx-auto h-8 w-8 text-muted-foreground" />

          <h1 className="mt-4 font-display text-xl font-semibold">
            Announcement not found
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            This announcement may have been deleted, deactivated,
            or is no longer available.
          </p>

          <Button asChild className="mt-5">
            <Link to="/dashboard">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <Button asChild variant="ghost" size="sm">
        <Link to="/dashboard">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Dashboard
        </Link>
      </Button>

      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border bg-primary/[0.03] p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
            <Megaphone className="h-4 w-4" />
            Announcement
          </div>

          <h1 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
            {data.title}
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {data.body}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="whitespace-pre-wrap text-sm leading-7 text-foreground sm:text-base">
            {data.content?.trim()
              ? data.content
              : data.body}
          </div>

          {data.link && (
            <div className="mt-8 border-t border-border pt-6">
              <Button asChild>
                <a
                  href={data.link}
                  target={
                    data.link.startsWith("/")
                      ? undefined
                      : "_blank"
                  }
                  rel={
                    data.link.startsWith("/")
                      ? undefined
                      : "noopener noreferrer"
                  }
                >
                  View related resource
                  <ExternalLink className="ml-1.5 h-4 w-4" />
                </a>
              </Button>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}