import { useState } from "react";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import type { ReactNode } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
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
      { title: "Pricing — Aneks Library" },
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
    <div className="mx-auto max-w-7xl space-y-12 py-8">

      {/* Hero */}

      <section className="text-center">

        <Badge className="mb-4">
          <Crown className="mr-2 h-4 w-4" />
          Premium
        </Badge>

        <h1 className="font-display text-5xl font-bold">
          Upgrade to Premium
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Unlock unlimited downloads, premium academic resources,
          early access to new features, and enjoy an ad-free study
          experience.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">

      <Button
      variant="outline"
      size="lg"
      onClick={() => navigate({ to: ".." })}
      >
      Continue with Free
      </Button>

      <Button
      size="lg"
      className="min-w-[220px]"
      onClick={() => setUpgradeOpen(true)}
      >
      Upgrade to Premium
      </Button>

      </div>

      </section>

      <Separator />

      {/* Pricing */}

      <section className="grid gap-8 lg:grid-cols-2">

        <Card>

          <CardContent className="p-8">

            <h2 className="text-2xl font-bold">
              Free
            </h2>

            <p className="mt-2 text-5xl font-bold">
              ₦0
            </p>

            <p className="mt-1 text-muted-foreground">
              Forever
            </p>

            <div className="mt-8 space-y-4">

              <Feature text="Browse Resources" />
              <Feature text="Preview Resources" />
              <Feature text="Bookmark Resources" />
              <Feature text="Upload Resources" />
              <Feature text="No Downloads" />
              <Feature text="Advertisements" />

            </div>

            <Button
              variant="outline"
              className="mt-8 w-full"
            >
              Free Plan
            </Button>

          </CardContent>

        </Card>

        <Card className="border-2 border-primary shadow-xl">

          <CardContent className="p-8">

            <Badge className="mb-4">
              Recommended
            </Badge>

            <h2 className="text-2xl font-bold">
              Premium
            </h2>

            <p className="mt-2 text-5xl font-bold">
              ₦3,000
            </p>

            <p className="mt-1 text-muted-foreground">
              per month
            </p>

            <div className="mt-8 space-y-4">

              <Feature text="Unlimited Downloads" />
              <Feature text="Premium Resources" />
              <Feature text="No Advertisements" />
              <Feature text="Priority Support" />
              <Feature text="Early Access" />
              <Feature text="Premium Badge" />

            </div>

            <Button
            className="mt-8 w-full"
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

        <h2 className="mb-8 text-center text-3xl font-bold">
          Why Students Choose Premium
        </h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">

          <Benefit
            icon={<BookOpen className="h-8 w-8" />}
            title="Unlimited Downloads"
            desc="Download as many academic resources as you need."
          />

          <Benefit
            icon={<Zap className="h-8 w-8" />}
            title="Instant Access"
            desc="No waiting. Everything is available immediately."
          />

          <Benefit
            icon={<ShieldCheck className="h-8 w-8" />}
            title="Secure Access"
            desc="Premium-only protected academic materials."
          />

          <Benefit
            icon={<Crown className="h-8 w-8" />}
            title="Premium Experience"
            desc="No ads, cleaner interface and future premium features."
          />

        </div>

      </section>

      <Separator />

      {/* Payments */}

      <Card>

        <CardContent className="space-y-4 p-8">

          <div className="flex items-center gap-3">

            <CreditCard className="h-7 w-7 text-primary" />

            <h2 className="text-2xl font-bold">
              Secure Payments
            </h2>

          </div>

          <p className="text-muted-foreground">
            Payments are securely processed through Flutterwave.
            We support Visa, Mastercard, Verve,
            Bank Transfer and USSD.
            Your payment information is never stored
            by Aneks Library.
          </p>

        </CardContent>

      </Card>

            {/* FAQ */}

      <Card>

        <CardContent className="space-y-8 p-8">

          <h2 className="text-2xl font-bold">
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
    <div className="flex items-center gap-3">
      <CheckCircle2 className="h-5 w-5 text-green-600" />
      <span>{text}</span>
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

      <CardContent className="space-y-4 p-6">

        {icon}

        <h3 className="font-semibold">
          {title}
        </h3>

        <p className="text-sm text-muted-foreground">
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

      <h3 className="font-semibold">
        {q}
      </h3>

      <p className="mt-2 text-muted-foreground">
        {a}
      </p>
    
    </div>
  );
}