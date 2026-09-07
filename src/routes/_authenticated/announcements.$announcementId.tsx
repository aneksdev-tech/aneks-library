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

type Profile = {
  full_name: string | null;
  email: string;
};

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
            "id, title, body, content, link, is_active, created_at, updated_at, created_by, updated_by, deleted_at",
          )
          .eq("id", announcementId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .maybeSingle();

      if (announcementError) {
        throw announcementError;
      }

      if (!announcement) {
        return null;
      }

      const profileIds = [
        ...new Set(
          [
            announcement.created_by,
            announcement.updated_by,
          ].filter(
            (id): id is string => Boolean(id),
          ),
        ),
      ];

      if (!profileIds.length) {
        return {
          announcement,
          creator: null,
          updater: null,
        };
      }

      const { data: profiles, error: profilesError } =
        await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds);

      if (profilesError) {
        throw profilesError;
      }

      const profileMap = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile,
        ]),
      );

      return {
        announcement,
        creator: announcement.created_by
          ? profileMap.get(announcement.created_by) ?? null
          : null,
        updater: announcement.updated_by
          ? profileMap.get(announcement.updated_by) ?? null
          : null,
      };
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

  const { announcement, creator, updater } = data;

  const creatorName =
    creator?.full_name ?? creator?.email ?? "Unknown user";

  const updaterName =
    updater?.full_name ?? updater?.email ?? "Unknown user";

  const hasBeenUpdated =
    announcement.updated_at !== announcement.created_at;

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
            {announcement.title}
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {announcement.body}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="whitespace-pre-wrap text-sm leading-7 text-foreground sm:text-base">
            {announcement.content?.trim()
              ? announcement.content
              : announcement.body}
          </div>

          {announcement.link && (
            <div className="mt-8 border-t border-border pt-6">
              <Button asChild>
                <a
                  href={announcement.link}
                  target={
                    announcement.link.startsWith("/")
                      ? undefined
                      : "_blank"
                  }
                  rel={
                    announcement.link.startsWith("/")
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

        <div className="border-t border-border bg-muted/20 px-6 py-5 sm:px-8">
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">
                Created by:
              </span>{" "}
              {creatorName}
            </p>

            {creator?.full_name && creator.email && (
              <p>
                <span className="font-medium text-foreground">
                  Email:
                </span>{" "}
                {creator.email}
              </p>
            )}

            <p>
              <span className="font-medium text-foreground">
                Created:
              </span>{" "}
              {new Date(
                announcement.created_at,
              ).toLocaleString()}
            </p>

            {hasBeenUpdated && (
              <>
                <p>
                  <span className="font-medium text-foreground">
                    Updated by:
                  </span>{" "}
                  {updaterName}
                </p>

                <p>
                  <span className="font-medium text-foreground">
                    Updated:
                  </span>{" "}
                  {new Date(
                    announcement.updated_at,
                  ).toLocaleString()}
                </p>
              </>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}