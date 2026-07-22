import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Mail, ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/verify-email")({
  validateSearch: z.object({ email: z.string().optional() }),
  head: () => ({ meta: [{ title: "Verify your email | Aneks Library" }, { name: "robots", content: "noindex" }] }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { email } = Route.useSearch();
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    if (!email) return toast.error("No email on file — go back to sign up.");
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/verify-email` } });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Verification email sent again.");
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-elegant">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-gradient-emerald text-primary-foreground">
          <Mail className="h-6 w-6" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold">Verify your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a verification link to <span className="text-foreground">{email ?? "your inbox"}</span>. Click the link to activate your account.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={resend} disabled={busy} className="bg-gradient-emerald text-primary-foreground">
            Resend verification email
          </Button>
          <Button asChild variant="outline">
            <Link to="/auth" search={{ mode: "login" }}>
              Back to sign in <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <GraduationCap className="h-3 w-3" /> Aneks Library
        </Link>
      </div>
    </div>
  );
}
