import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
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
      className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-background/70 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-popup-title"
    >
      <div className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card shadow-elegant sm:rounded-2xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 sm:right-4 sm:top-4"
          aria-label="Close announcement"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>

        <div className="p-4 sm:p-8">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="min-w-0 pr-7 sm:pr-8">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gold sm:text-xs">
                Announcement
              </p>

              <h2
                id="announcement-popup-title"
                className="mt-1 font-display text-lg font-semibold sm:text-2xl"
              >
                {announcement.title}
              </h2>
            </div>
          </div>

          <div className="mt-4 whitespace-pre-wrap text-xs leading-5 text-muted-foreground sm:mt-6 sm:text-base sm:leading-7">
            {fullContent}
          </div>

          <div className="mt-5 flex justify-end sm:mt-7">
            <Button
              type="button"
              onClick={handleClose}
              className="h-9 bg-gradient-emerald px-3 text-xs text-primary-foreground sm:h-10 sm:px-4 sm:text-sm"
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}