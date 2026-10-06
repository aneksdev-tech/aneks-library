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
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
          Loading announcement…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="grid min-h-[40vh] place-items-center px-3 sm:px-0">
        <div className="max-w-md text-center">
          <Megaphone className="mx-auto h-7 w-7 text-muted-foreground sm:h-8 sm:w-8" />

          <h1 className="mt-3 font-display text-lg font-semibold sm:mt-4 sm:text-xl">
            Announcement not found
          </h1>

          <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-normal">
            This announcement may have been deleted, deactivated,
            or is no longer available.
          </p>

          <Button
            asChild
            className="mt-4 h-9 text-xs sm:mt-5 sm:h-10 sm:text-sm"
          >
            <Link to="/dashboard">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-8 text-xs sm:h-9 sm:text-sm"
      >
        <Link to="/dashboard">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Back to Dashboard
        </Link>
      </Button>

      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border bg-primary/[0.03] p-4 sm:p-8">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-primary sm:gap-2 sm:text-xs">
            <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Announcement
          </div>

          <h1 className="mt-2.5 font-display text-xl font-semibold leading-tight sm:mt-3 sm:text-3xl">
            {data.title}
          </h1>

          <p className="mt-2.5 text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-6">
            {data.body}
          </p>
        </div>

        <div className="p-4 sm:p-8">
          <div className="whitespace-pre-wrap text-xs leading-6 text-foreground sm:text-base sm:leading-7">
            {data.content?.trim()
              ? data.content
              : data.body}
          </div>

          {data.link && (
            <div className="mt-6 border-t border-border pt-4 sm:mt-8 sm:pt-6">
              <Button
                asChild
                className="h-9 text-xs sm:h-10 sm:text-sm"
              >
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
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </a>
              </Button>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}