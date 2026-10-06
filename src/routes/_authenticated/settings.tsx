import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-gold sm:text-xs">
          Settings
        </p>

        <h1 className="mt-1 font-display text-lg font-semibold sm:text-3xl">
          Preferences
        </h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3.5 shadow-soft sm:p-6">
        <h2 className="font-display text-base font-semibold sm:text-lg">
          Appearance
        </h2>

        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Choose how Aneks Library looks on this device.
        </p>

        <div className="mt-3 flex gap-2 sm:mt-4">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            onClick={() => setTheme("light")}
            className="h-9 text-xs sm:h-10 sm:text-sm"
          >
            <Sun className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
            Light
          </Button>

          <Button
            variant={theme === "dark" ? "default" : "outline"}
            onClick={() => setTheme("dark")}
            className="h-9 text-xs sm:h-10 sm:text-sm"
          >
            <Moon className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
            Dark
          </Button>
        </div>
      </div>
    </div>
  );
}