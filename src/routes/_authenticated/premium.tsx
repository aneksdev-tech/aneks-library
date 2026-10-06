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
      <div className="p-4 text-sm sm:p-8">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
      <div className="rounded-2xl border bg-card p-4 shadow-soft sm:rounded-3xl sm:p-6">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div>
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 sm:h-10 sm:w-10">
              <Crown className="h-6 w-6 text-yellow-500 sm:h-8 sm:w-8" />
            </div>

            <h1 className="font-display text-xl font-bold sm:text-2xl">
              Aneks Library Premium
            </h1>

            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Unlimited downloads. Faster learning. Premium experience.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border p-4 sm:p-6">
          <h2 className="text-lg font-semibold sm:text-xl">
            Free Plan
          </h2>

          <p className="mt-1.5 text-3xl font-bold sm:mt-2 sm:text-4xl">
            ₦0
          </p>

          <div className="mt-5 space-y-2.5 sm:mt-6 sm:space-y-3">
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
            className="mt-6 h-9 w-full text-xs sm:mt-8 sm:h-10 sm:text-sm"
            variant="outline"
          >
            Current Plan
          </Button>
        </div>

        <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4 sm:p-6">
          <div className="mb-2.5 inline-flex rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground sm:mb-3 sm:px-3 sm:text-xs">
            Recommended
          </div>

          <h2 className="text-lg font-semibold sm:text-xl">
            Premium
          </h2>

          <p className="mt-1.5 text-3xl font-bold sm:mt-2 sm:text-4xl">
            ₦3,000
            <span className="text-base font-normal sm:text-lg">
              /month
            </span>
          </p>

          <div className="mt-5 space-y-2.5 sm:mt-6 sm:space-y-3">
            <Feature text="Unlimited Downloads" />

            <Feature text="Premium Resources" />

            <Feature text="No Ads" />

            <Feature text="Early Access" />

            <Feature text="Premium badge" />

            <Feature text="Priority Support" />

            <Feature text="Future Premium Features" />
          </div>

          {isAdmin ? (
            <Button
              disabled
              className="mt-6 h-9 w-full text-xs sm:mt-8 sm:h-10 sm:text-sm"
            >
              Administrator
            </Button>
          ) : isPremium ? (
            <Button
              disabled
              className="mt-6 h-9 w-full text-xs sm:mt-8 sm:h-10 sm:text-sm"
            >
              Current Plan
            </Button>
          ) : (
            <Button className="mt-6 h-9 w-full text-xs sm:mt-8 sm:h-10 sm:text-sm">
              Upgrade to Premium
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border p-4 sm:p-6">
        <h2 className="text-xl font-semibold sm:text-2xl">
          Secure Payments
        </h2>

        <p className="mt-2 text-xs leading-5 text-muted-foreground sm:mt-3 sm:text-sm sm:leading-6">
          Payments are securely processed through Flutterwave.
          Your card details are never stored by Aneks Library.
        </p>
      </div>

      <div className="rounded-2xl border p-4 sm:p-6">
        <h2 className="text-xl font-semibold sm:text-2xl">
          Frequently Asked Questions
        </h2>

        <div className="mt-5 space-y-5 sm:mt-6 sm:space-y-6">
          <div>
            <h3 className="text-sm font-medium sm:text-base">
              What does Premium include?
            </h3>

            <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
              Unlimited downloads, premium resources, No Ads, and future premium features.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium sm:text-base">
              Can I cancel anytime?
            </h3>

            <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
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
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 sm:h-5 sm:w-5" />
      <span className="text-xs sm:text-sm">
        {text}
      </span>
    </div>
  );
}