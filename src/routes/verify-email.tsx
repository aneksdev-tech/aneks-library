import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Mail, ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/verify-email")({
  validateSearch: z.object({ email: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Verify your email | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { email } = Route.useSearch();
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    if (!email) {
      toast.error("No email available.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("A new verification email has been sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 text-center shadow-elegant sm:rounded-2xl sm:p-8">
        <span className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-gradient-emerald text-primary-foreground sm:h-12 sm:w-12 sm:rounded-xl">
          <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>

        <h1 className="mt-4 font-display text-lg font-semibold sm:mt-6 sm:text-2xl">
          Verify your email
        </h1>

        <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
          We sent a verification link to{" "}
          <span className="text-foreground">{email ?? "your inbox"}</span>.
          Click the link to activate your account.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:mt-6">
          <Button
            onClick={resend}
            disabled={busy}
            className="h-9 bg-gradient-emerald text-xs text-primary-foreground sm:h-10 sm:text-sm"
          >
            {busy ? "Sending..." : "Resend verification email"}
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-9 text-xs sm:h-10 sm:text-sm"
          >
            <Link to="/auth" search={{ mode: "login" }}>
              Back to sign in
              <ArrowRight className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Link>
          </Button>
        </div>

        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground sm:mt-6 sm:gap-2 sm:text-xs"
        >
          <GraduationCap className="h-3 w-3" />
          Aneks Library
        </Link>
      </div>
    </div>
  );
}