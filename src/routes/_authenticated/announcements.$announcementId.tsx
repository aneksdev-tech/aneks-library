import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Megaphone,
} from "lucide-react";
import { useEffect } from "react";

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
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "announcement",
      announcementId,
    ],
    queryFn: async () => {
      const {
        data: announcement,
        error: announcementError,
      } = await supabase
        .from("announcements")
        .select(
          "id, title, body, content, link, is_active, deleted_at",
        )
        .eq("id", announcementId)
        .is("deleted_at", null)
        .maybeSingle();

      if (announcementError) {
        throw announcementError;
      }

      return announcement;
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    const markAsRead = async () => {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const {
        error,
      } = await supabase.rpc(
        "mark_announcement_as_read",
        {
          _announcement_id:
            data.id,
        },
      );

      if (error) {
        console.error(
          "Failed to mark announcement as read:",
          error,
        );

        return;
      }

      queryClient.invalidateQueries({
        queryKey: [
          "announcements",
          user.id,
        ],
      });

      queryClient.invalidateQueries({
        queryKey: [
          "announcement-count",
          user.id,
        ],
      });
    };

    markAsRead();
  }, [data, queryClient]);

  if (isLoading) {
    return (
      <section className="grid min-h-[35vh] place-items-center sm:min-h-[40vh]">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
          Loading announcement…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="grid min-h-[35vh] place-items-center px-3 sm:min-h-[40vh] sm:px-0">
        <div className="max-w-md text-center">
          <Megaphone className="mx-auto h-6 w-6 text-muted-foreground sm:h-8 sm:w-8" />

          <h1 className="mt-3 font-display text-base font-semibold sm:mt-4 sm:text-xl">
            Announcement not found
          </h1>

          <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
            This announcement may have been deleted or is no
            longer available to you.
          </p>

          <Button
            asChild
            className="mt-4 h-9 text-xs sm:mt-5 sm:h-10 sm:text-sm"
          >
            <Link to="/announcements">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Back to Announcements
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <Link
        to="/announcements"
        className="inline-flex items-center text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-sm"
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Back to Announcements
      </Link>

      <article className="mt-4 border-y border-border sm:mt-6">
        <div className="py-3.5 sm:py-6">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-primary sm:gap-2 sm:text-xs">
            <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {data.is_active
              ? "Current Announcement"
              : "Announcement"}
          </div>

          <h1 className="mt-2 font-display text-base font-semibold leading-tight sm:mt-3 sm:text-2xl">
            {data.title}
          </h1>

          <p className="mt-2 text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-6">
            {data.body}
          </p>
        </div>

        <div className="border-t border-border py-3.5 sm:py-6">
          <div className="whitespace-pre-wrap text-xs leading-5 text-foreground sm:text-base sm:leading-7">
            {data.content?.trim()
              ? data.content
              : data.body}
          </div>

          {data.link && (
            <div className="mt-5 border-t border-border pt-3.5 sm:mt-8 sm:pt-6">
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
