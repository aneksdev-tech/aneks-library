import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">
            Notifications
          </p>

          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-display text-3xl font-semibold">
              What's new for you
            </h1>

            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
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
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            {markAll.isPending ? "Marking…" : "Mark all read"}
          </Button>
        )}
      </div>

      {/* Notification list */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
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
                  className={`flex gap-3 p-5 transition-colors ${
                    n.read
                      ? "opacity-65"
                      : "bg-primary/[0.03] hover:bg-primary/[0.05]"
                  }`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bell
                      className={`h-4 w-4 ${
                        n.read
                          ? "text-muted-foreground"
                          : "text-primary"
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-medium ${
                            !n.read ? "font-semibold" : ""
                          }`}
                        >
                          {n.title}
                        </p>

                        {mainMessage && (
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {mainMessage}
                          </p>
                        )}

                        {isRejected && rejectionReason && (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            <span className="font-medium text-foreground">
                              Reason:
                            </span>{" "}
                            {rejectionReason}
                          </p>
                        )}

                        <p className="mt-1 text-xs text-muted-foreground">
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
                          className="shrink-0 text-xs"
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          Read
                        </Button>
                      )}
                    </div>

                    {n.link && (
                      <div className="mt-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          Open notification
                          <ExternalLink className="h-3.5 w-3.5" />
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