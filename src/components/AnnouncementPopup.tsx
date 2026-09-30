import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AnnouncementPopup() {
  const [open, setOpen] = useState(false);

  const { data: announcement } = useQuery({
    queryKey: ["active-announcement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select(
          "id, title, body, content, link, created_at",
        )
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  /*
   * Clear announcement-seen markers when the user
   * signs out so the active announcement can appear
   * again after the next sign-in.
   */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          Object.keys(sessionStorage)
            .filter((key) =>
              key.startsWith(
                "announcement-seen:",
              ),
            )
            .forEach((key) => {
              sessionStorage.removeItem(key);
            });

          setOpen(false);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!announcement || announcement.link) {
      return;
    }

    const seenKey =
      `announcement-seen:${announcement.id}`;

    if (sessionStorage.getItem(seenKey)) {
      return;
    }

    const timer = window.setTimeout(() => {
      setOpen(true);
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [announcement]);

  const handleClose = () => {
    if (!announcement) {
      return;
    }

    sessionStorage.setItem(
      `announcement-seen:${announcement.id}`,
      "true",
    );

    setOpen(false);
  };

  if (
    !open ||
    !announcement ||
    announcement.link
  ) {
    return null;
  }

  const fullContent =
    announcement.content?.trim() ||
    announcement.body;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-popup-title"
    >
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card shadow-elegant">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="Close announcement"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>

            <div className="min-w-0 pr-8">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
                Announcement
              </p>

              <h2
                id="announcement-popup-title"
                className="mt-1 font-display text-xl font-semibold sm:text-2xl"
              >
                {announcement.title}
              </h2>
            </div>
          </div>

          <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-muted-foreground sm:text-base">
            {fullContent}
          </div>

          <div className="mt-7 flex justify-end">
            <Button
              type="button"
              onClick={handleClose}
              className="bg-gradient-emerald text-primary-foreground"
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}