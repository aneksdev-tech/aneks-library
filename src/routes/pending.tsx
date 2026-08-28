import { createFileRoute } from "@tanstack/react-router";
import { Clock3, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/pending")({
  component: PendingPage,
});

function PendingPage() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
          <Clock3 className="h-8 w-8 text-amber-500" />
        </div>

        <h1 className="mt-6 text-center font-display text-3xl font-semibold">
          Account Pending Approval
        </h1>

        <p className="mt-4 text-center leading-7 text-muted-foreground">
          Your account has been verified successfully. <br />
        </p>

        <p className="mt-3 text-center leading-7 text-muted-foreground">
          An administrator is currently reviewing your account. You'll
          receive access as soon as your registration is approved.
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