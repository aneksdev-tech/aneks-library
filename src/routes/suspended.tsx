import { createFileRoute } from "@tanstack/react-router";
import { Ban, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/suspended")({
  component: SuspendedPage,
});

function SuspendedPage() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <Ban className="h-8 w-8 text-destructive" />
        </div>

        <h1 className="mt-6 text-center font-display text-3xl font-semibold">
          Account Suspended
        </h1>

        <p className="mt-4 text-center leading-7 text-muted-foreground">
          Your Aneks Library account has been suspended.
        </p>

        <p className="mt-3 text-center leading-7 text-muted-foreground">
          You currently cannot access your account or use the library.
          Please contact an administrator if you believe this suspension
          was made in error.
        </p>

        <Button
          className="mt-8 w-full"
          variant="outline"
          onClick={() => signOut()}
        >
          Sign Out
          <LogOut className="mr-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
