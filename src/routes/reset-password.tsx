import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    // Supabase sets a recovery session automatically when the user lands here from the email link.
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      setReady(!!data.session);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")
        setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8)
      return toast.error("Password must be at least 8 characters.");
    if (pw !== confirm)
      return toast.error("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    nav({ to: "/auth", search: { mode: "login" } });
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-elegant sm:rounded-2xl sm:p-8">
        <span className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-gradient-emerald text-primary-foreground sm:h-12 sm:w-12 sm:rounded-xl">
          <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>

        <h1 className="mt-4 text-center font-display text-lg font-semibold sm:mt-6 sm:text-2xl">
          Set a new password
        </h1>

        <p className="mt-1.5 text-center text-xs text-muted-foreground sm:mt-2 sm:text-sm">
          Choose a password you haven't used before.
        </p>

        {!ready ? (
          <p className="mt-6 text-center text-xs text-muted-foreground sm:mt-8 sm:text-sm">
            Open the reset link from your email to continue.
          </p>
        ) : (
          <form
            onSubmit={submit}
            className="mt-5 space-y-3 sm:mt-6 sm:space-y-4"
          >
            <div>
              <Label htmlFor="pw" className="text-xs sm:text-sm">
                New password
              </Label>

              <div className="relative mt-1.5">
                <Input
                  id="pw"
                  type={show ? "text" : "password"}
                  required
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="h-9 text-xs sm:h-10 sm:text-sm"
                />

                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  {show ? (
                    <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirm" className="text-xs sm:text-sm">
                Confirm password
              </Label>

              <Input
                id="confirm"
                type={show ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5 h-9 text-xs sm:h-10 sm:text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="h-9 w-full bg-gradient-emerald text-xs text-primary-foreground sm:h-10 sm:text-sm"
            >
              {busy && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
              )}
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}