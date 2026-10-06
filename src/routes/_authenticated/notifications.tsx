import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Bell, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./dashboard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return data ?? [];
    },
  });

  const unreadCount = data?.filter((n) => !n.read).length ?? 0;

  const markRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .eq("user_id", user!.id);

      if (error) throw error;
    },

    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["notifications", user?.id],
      });

      qc.invalidateQueries({
        queryKey: ["notif-count", user?.id],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("All notifications marked as read.");

      qc.invalidateQueries({
        queryKey: ["notifications", user?.id],
      });

      qc.invalidateQueries({
        queryKey: ["notif-count", user?.id],
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleNotificationClick = (notificationId: string) => {
    markRead.mutate(notificationId);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
            Notifications
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="font-display text-lg font-semibold sm:text-3xl">
              What's new for you
            </h1>

            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary sm:px-2.5 sm:py-1 sm:text-xs">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
            className="h-8 self-start text-xs sm:h-9 sm:self-auto sm:text-sm"
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            {markAll.isPending ? "Marking…" : "Mark all read"}
          </Button>
        )}
      </div>

      {/* Notification list */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground sm:p-10 sm:text-sm">
            Loading notifications…
          </div>
        ) : data && data.length ? (
          <ul className="divide-y divide-border">
            {data.map((n) => {
              const isRejected =
                n.title === "Resource rejected" ||
                n.title === "Upload rejected";

              const body = n.body ?? "";

              let mainMessage = body;
              let rejectionReason: string | null = null;

              if (isRejected) {
                const reasonMarker = " Reason: ";
                const reasonIndex = body.indexOf(reasonMarker);

                if (reasonIndex !== -1) {
                  mainMessage = body.slice(0, reasonIndex);
                  rejectionReason = body.slice(
                    reasonIndex + reasonMarker.length,
                  );
                }
              }

              const notificationContent = (
                <div
                  className={`flex gap-2.5 p-3.5 transition-colors sm:gap-3 sm:p-5 ${
                    n.read
                      ? "opacity-65"
                      : "bg-primary/[0.03] hover:bg-primary/[0.05]"
                  }`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bell
                      className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                        n.read
                          ? "text-muted-foreground"
                          : "text-primary"
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2.5 sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm sm:text-base ${
                            !n.read ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {n.title}
                        </p>

                        {mainMessage && (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                            {mainMessage}
                          </p>
                        )}

                        {isRejected && rejectionReason && (
                          <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
                            <span className="font-medium text-foreground">
                              Reason:
                            </span>{" "}
                            {rejectionReason}
                          </p>
                        )}

                        <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>

                      {!n.read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={markRead.isPending}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            markRead.mutate(n.id);
                          }}
                          className="h-8 shrink-0 px-2 text-[10px] sm:h-9 sm:px-3 sm:text-xs"
                        >
                          <Check className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          Read
                        </Button>
                      )}
                    </div>

                    {n.link && (
                      <div className="mt-2.5 sm:mt-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary sm:text-xs">
                          Open notification
                          <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );

              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link
                      to={n.link}
                      onClick={() => {
                        if (!n.read) {
                          handleNotificationClick(n.id);
                        }
                      }}
                      className="block outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    >
                      {notificationContent}
                    </Link>
                  ) : (
                    notificationContent
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="You're all caught up"
            desc="Notifications about your uploads and account will appear here."
          />
        )}
      </div>
    </div>
  );
}