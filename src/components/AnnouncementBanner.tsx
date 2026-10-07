import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function AnnouncementBanner() {
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
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return data;
    },
  });

  if (!announcement) {
    return null;
  }

  const destination =
    announcement.link || `/announcements/${announcement.id}`;

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1 overflow-hidden">
        <a
          href={destination}
          className="block min-w-0 rounded-lg transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label={`View announcement: ${announcement.title}`}
        >
          <div
            className="announcement-marquee flex whitespace-nowrap text-sm"
            style={{ animationDuration: "10s" }}
          >
            <div className="flex items-center gap-8 px-4">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold" />
                <strong>{announcement.title}</strong>
                <span>—</span>
                <span>{announcement.body}</span>
                <span className="font-medium text-primary">
                  Read More →
                </span>
              </span>

              <span>
                {announcement.body}
              </span>
            </div>

            <div className="flex items-center gap-8 px-4">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold" />
                <strong>{announcement.title}</strong>
                <span>—</span>
                <span>{announcement.body}</span>
                <span className="font-medium text-primary">
                  Read More →
                </span>
              </span>

              <span>
                {announcement.body}
              </span>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
