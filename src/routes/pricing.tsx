import { useState } from "react";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import type { ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Crown,
  CheckCircle2,
  ShieldCheck,
  Zap,
  BookOpen,
  CreditCard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | Aneks Library" },
      {
        name: "description",
        content:
          "Compare Free and Premium plans for Aneks Library.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-7xl space-y-8 py-5 sm:space-y-12 sm:py-8">
      {/* Hero */}

      <section className="text-center">
        <Badge className="mb-3 text-[10px] sm:mb-4 sm:text-xs">
          <Crown className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
          Premium
        </Badge>

        <h1 className="font-display text-2xl font-bold sm:text-5xl">
          Upgrade to Premium
        </h1>

        <p className="mx-auto mt-3 max-w-2xl text-xs leading-5 text-muted-foreground sm:mt-4 sm:text-lg sm:leading-7">
          Unlock unlimited downloads, premium academic resources,
          early access to new features, and enjoy an ad-free study
          experience.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-8 sm:gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate({ to: ".." })}
            className="h-9 text-xs sm:h-10 sm:text-sm"
          >
            Continue with Free
          </Button>

          <Button
            size="lg"
            className="h-9 min-w-[180px] text-xs sm:h-10 sm:min-w-[220px] sm:text-sm"
            onClick={() => setUpgradeOpen(true)}
          >
            Upgrade to Premium
          </Button>
        </div>
      </section>

      <Separator />

      {/* Pricing */}

      <section className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4 sm:p-8">
            <h2 className="text-xl font-bold sm:text-2xl">
              Free
            </h2>

            <p className="mt-1.5 text-3xl font-bold sm:mt-2 sm:text-5xl">
              ₦0
            </p>

            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Forever
            </p>

            <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
              <Feature text="Browse Resources" />
              <Feature text="Preview Resources" />
              <Feature text="Bookmark Resources" />
              <Feature text="Upload Resources" />
              <Feature text="No Downloads" />
              <Feature text="Advertisements" />
            </div>

            <Button
              variant="outline"
              className="mt-6 h-9 w-full text-xs sm:mt-8 sm:h-10 sm:text-sm"
            >
              Free Plan
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 border-primary shadow-xl">
          <CardContent className="p-4 sm:p-8">
            <Badge className="mb-3 text-[10px] sm:mb-4 sm:text-xs">
              Recommended
            </Badge>

            <h2 className="text-xl font-bold sm:text-2xl">
              Premium
            </h2>

            <p className="mt-1.5 text-3xl font-bold sm:mt-2 sm:text-5xl">
              ₦3,000
            </p>

            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              per month
            </p>

            <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
              <Feature text="Unlimited Downloads" />
              <Feature text="Premium Resources" />
              <Feature text="No Advertisements" />
              <Feature text="Priority Support" />
              <Feature text="Early Access" />
              <Feature text="Premium Badge" />
            </div>

            <Button
              className="mt-6 h-9 w-full text-xs sm:mt-8 sm:h-10 sm:text-sm"
              onClick={() => setUpgradeOpen(true)}
            >
              Upgrade to Premium
            </Button>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Benefits */}

      <section>
        <h2 className="mb-6 text-center text-xl font-bold sm:mb-8 sm:text-3xl">
          Why Students Choose Premium
        </h2>

        <div className="grid gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Benefit
            icon={<BookOpen className="h-6 w-6 sm:h-8 sm:w-8" />}
            title="Unlimited Downloads"
            desc="Download as many academic resources as you need."
          />

          <Benefit
            icon={<Zap className="h-6 w-6 sm:h-8 sm:w-8" />}
            title="Instant Access"
            desc="No waiting. Everything is available immediately."
          />

          <Benefit
            icon={<ShieldCheck className="h-6 w-6 sm:h-8 sm:w-8" />}
            title="Secure Access"
            desc="Premium-only protected academic materials."
          />

          <Benefit
            icon={<Crown className="h-6 w-6 sm:h-8 sm:w-8" />}
            title="Premium Experience"
            desc="No ads, cleaner interface and future premium features."
          />
        </div>
      </section>

      <Separator />

      {/* Payments */}

      <Card>
        <CardContent className="space-y-3 p-4 sm:space-y-4 sm:p-8">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <CreditCard className="h-5 w-5 text-primary sm:h-7 sm:w-7" />

            <h2 className="text-lg font-bold sm:text-2xl">
              Secure Payments
            </h2>
          </div>

          <p className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
            Payments are securely processed through Flutterwave.
            We support Visa, Mastercard, Verve, Bank Transfer and
            USSD. Your payment information is never stored by Aneks
            Library.
          </p>
        </CardContent>
      </Card>

      {/* FAQ */}

      <Card>
        <CardContent className="space-y-6 p-4 sm:space-y-8 sm:p-8">
          <h2 className="text-lg font-bold sm:text-2xl">
            Frequently Asked Questions
          </h2>

          <FAQ
            q="Can I cancel anytime?"
            a="Yes. You can cancel whenever you want."
          />

          <FAQ
            q="How long does Premium last?"
            a="30 days from successful payment."
          />

          <FAQ
            q="When do I get access?"
            a="Immediately after payment confirmation."
          />
        </CardContent>
      </Card>

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
      />
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 sm:h-5 sm:w-5" />
      <span className="text-xs sm:text-sm">{text}</span>
    </div>
  );
}

function Benefit({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:space-y-4 sm:p-6">
        {icon}

        <h3 className="text-sm font-semibold sm:text-base">
          {title}
        </h3>

        <p className="text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
          {desc}
        </p>
      </CardContent>
    </Card>
  );
}

function FAQ({
  q,
  a,
}: {
  q: string;
  a: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold sm:text-base">
        {q}
      </h3>

      <p className="mt-1.5 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">
        {a}
      </p>
    </div>
  );
}