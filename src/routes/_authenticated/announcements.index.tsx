import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CheckCheck,
  Loader2,
  Megaphone,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "./dashboard";

export const Route = createFileRoute(
  "/_authenticated/announcements/",
)({
  head: () => ({
    meta: [
      { title: "Announcements | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Announcements,
});

function Announcements() {
  const queryClient = useQueryClient();

  const {
    data: {
      user,
    } = {},
  } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const {
        data,
        error,
      } = await supabase.auth.getUser();

      if (error) {
        throw error;
      }

      return {
        user: data.user,
      };
    },
  });

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "announcements",
      user?.id,
    ],
    enabled: !!user,
    queryFn: async () => {
      const {
        data: announcements,
        error: announcementsError,
      } = await supabase
        .from("announcements")
        .select(
          "id, title, body, content, link, is_active, published_at",
        )
        .is("deleted_at", null)
        .not("published_at", "is", null)
        .order("published_at", {
          ascending: false,
        });

      if (announcementsError) {
        throw announcementsError;
      }

      if (!announcements?.length) {
        return [];
      }

      const announcementIds =
        announcements.map(
          (announcement) =>
            announcement.id,
        );

      const {
        data: reads,
        error: readsError,
      } = await supabase
        .from("announcement_reads")
        .select(
          "announcement_id, read_at",
        )
        .eq("user_id", user!.id)
        .in(
          "announcement_id",
          announcementIds,
        );

      if (readsError) {
        throw readsError;
      }

      const readIds = new Set(
        (reads ?? []).map(
          (read) =>
            read.announcement_id,
        ),
      );

      return announcements.map(
        (announcement) => ({
          ...announcement,
          is_read: readIds.has(
            announcement.id,
          ),
        }),
      );
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (
      announcementId: string,
    ) => {
      if (!user) {
        throw new Error(
          "You must be signed in.",
        );
      }

      const {
        error,
      } = await supabase
        .from("announcement_reads")
        .insert({
          announcement_id:
            announcementId,
          user_id: user.id,
        });

      if (
        error &&
        error.code !== "23505"
      ) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "announcements",
          user?.id,
        ],
      });

      queryClient.invalidateQueries({
        queryKey: [
          "announcement-count",
          user?.id,
        ],
      });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error(
          "You must be signed in.",
        );
      }

      const unreadAnnouncements =
        data?.filter(
          (announcement) =>
            !announcement.is_read,
        ) ?? [];

      if (!unreadAnnouncements.length) {
        return;
      }

      const {
        error,
      } = await supabase
        .from("announcement_reads")
        .insert(
          unreadAnnouncements.map(
            (announcement) => ({
              announcement_id:
                announcement.id,
              user_id: user.id,
            }),
          ),
        );

      if (
        error &&
        error.code !== "23505"
      ) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "announcements",
          user?.id,
        ],
      });

      queryClient.invalidateQueries({
        queryKey: [
          "announcement-count",
          user?.id,
        ],
      });
    },
  });

  const hasUnread =
    data?.some(
      (announcement) =>
        !announcement.is_read,
    ) ?? false;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
            Announcements
          </p>

          <h1 className="mt-1 font-display text-lg font-semibold sm:text-3xl">
            Stay up to date
          </h1>

          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
            Important updates and news from Aneks Library.
          </p>
        </div>

        {hasUnread && (
          <button
            type="button"
            className="mb-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:pointer-events-none disabled:opacity-50 sm:mb-1 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
            disabled={
              markAllAsRead.isPending
            }
            onClick={() =>
              markAllAsRead.mutate()
            }
          >
            <CheckCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />

            {markAllAsRead.isPending
              ? "Marking…"
              : "Mark all as read"}
          </button>
        )}
      </div>

      {/* Announcement list */}
      {isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-2 sm:text-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
            Loading announcements…
          </div>
        </div>
      ) : error ? (
        <div className="grid min-h-[30vh] place-items-center px-3 sm:px-0">
          <div className="max-w-md text-center">
            <Megaphone className="mx-auto h-6 w-6 text-muted-foreground sm:h-8 sm:w-8" />

            <h2 className="mt-3 font-display text-base font-semibold sm:mt-4 sm:text-xl">
              Unable to load announcements
            </h2>

            <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
              Something went wrong while loading announcements.
              Please try again later.
            </p>
          </div>
        </div>
      ) : data && data.length ? (
        <div className="divide-y divide-border border-y border-border">
          {data.map((announcement) => {
            const preview =
              announcement.content?.trim() ||
              announcement.body;

            const truncatedPreview =
              preview.length > 180
                ? `${preview.slice(0, 180).trimEnd()}…`
                : preview;

            return (
              <article
                key={announcement.id}
                className="group py-3.5 sm:py-5"
              >
                {announcement.is_active && (
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gold sm:mb-2.5 sm:text-xs">
                    CURRENT
                  </div>
                )}

                <Link
                  to="/announcements/$announcementId"
                  params={{
                    announcementId:
                      announcement.id,
                  }}
                  className="block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  onClick={() => {
                    if (!announcement.is_read) {
                      markAsRead.mutate(
                        announcement.id,
                      );
                    }
                  }}
                >
                  <div className="flex min-w-0 items-baseline gap-2">
                    <h2 className="min-w-0 flex-1 font-display text-[13px] font-semibold leading-snug sm:text-lg">
                      {announcement.title}
                    </h2>

                    {!announcement.is_read && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gold sm:text-xs">
                        New
                      </span>
                    )}
                  </div>

                  {truncatedPreview && (
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
                      {truncatedPreview}
                    </p>
                  )}
                </Link>

                {announcement.published_at && (
                  <div className="mt-1.5 flex items-center justify-between gap-2 sm:mt-2">
                    <p className="min-w-0 text-[10px] text-muted-foreground sm:text-xs">
                      {new Date(
                        announcement.published_at,
                      ).toLocaleString()}
                    </p>

                    <Link
                      to="/announcements/$announcementId"
                      params={{
                        announcementId:
                          announcement.id,
                      }}
                      className="shrink-0 text-[10px] font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-xs"
                      onClick={() => {
                        if (!announcement.is_read) {
                          markAsRead.mutate(
                            announcement.id,
                          );
                        }
                      }}
                    >
                      View &gt;
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No announcements yet"
          desc="Announcements and important updates will appear here."
        />
      )}
    </div>
  );
}
