import { createFileRoute } from "@tanstack/react-router";
import { Crown, CheckCircle2 } from "lucide-react";
import { useAccess } from "@/hooks/useAccess";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/premium")({
  head: () => ({
    meta: [
      { title: "Premium | Aneks Library" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PremiumPage,
});

function PremiumPage() {
  const { loading, isAdmin, isPremium } = useAccess();

  if (loading) {
  return (
    <div className="p-8">
      Loading...
    </div>
  );
}

  return (
    <div className="mx-auto max-w-6xl space-y-8">

      <div className="rounded-3xl border bg-card p-8 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-yellow-500/15 p-3">
            <Crown className="h-8 w-8 text-yellow-500" />
          </div>

          <div>
            <h1 className="font-display text-3xl font-bold">
              Aneks Library Premium
            </h1>

            <p className="text-muted-foreground">
              Unlimited downloads. Faster learning. Premium experience.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold">
            Free Plan
          </h2>

          <p className="mt-2 text-4xl font-bold">
            ₦0
          </p>

          <div className="mt-6 space-y-3">

            <Feature text="Browse Resources" />

            <Feature text="Preview Resources" />

            <Feature text="Bookmark Resources" />

            <Feature text="Upload Resources" />

            <Feature text="No Downloads" />

            <Feature text="No Premium Materials" />

            <Feature text="Ads" />

          </div>

          <Button
            disabled
            className="mt-8 w-full"
            variant="outline"
          >
            Current Plan
          </Button>

        </div>

        <div className="rounded-2xl border-2 border-primary bg-primary/5 p-6">

          <div className="mb-3 inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            Recommended
          </div>

          <h2 className="text-xl font-semibold">
            Premium
          </h2>

          <p className="mt-2 text-4xl font-bold">
            ₦3,000
            <span className="text-lg font-normal">
              /month
            </span>
          </p>

          <div className="mt-6 space-y-3">

            <Feature text="Unlimited Downloads" />

            <Feature text="Premium Resources" />

            <Feature text="No Ads" />

            <Feature text="Early Access" />

            <Feature text="Premium badge" />

            <Feature text="Priority Support" />

            <Feature text="Future Premium Features" />

          </div>

          {isAdmin ? (
            <Button disabled className="mt-8 w-full">
            Administrator
            </Button>
        ) : isPremium ? (
            <Button disabled className="mt-8 w-full">
            Current Plan
            </Button>
        ) : (
            <Button className="mt-8 w-full">
            Upgrade to Premium
            </Button>
        )}

        </div>
      </div>

        <div className="rounded-2xl border p-6">
  <h2 className="text-2xl font-semibold">
    Secure Payments
  </h2>

  <p className="mt-3 text-muted-foreground">
    Payments are securely processed through Flutterwave.
    Your card details are never stored by Aneks Library.
  </p>
</div>

<div className="rounded-2xl border p-6">
  <h2 className="text-2xl font-semibold">
    Frequently Asked Questions
  </h2>

  <div className="mt-6 space-y-6">

    <div>
      <h3 className="font-medium">
        What does Premium include?
      </h3>

      <p className="text-muted-foreground">
        Unlimited downloads, premium resources, No Ads, and future premium features.
      </p>
    </div>

    <div>
      <h3 className="font-medium">
        Can I cancel anytime?
      </h3>

      <p className="text-muted-foreground">
        Yes.
      </p>
    </div>

  </div>
</div>
    </div>
  );
}

function Feature({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <CheckCircle2 className="h-5 w-5 text-green-600" />
      <span>{text}</span>
    </div>
  );
}