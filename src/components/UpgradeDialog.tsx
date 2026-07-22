import {
  Crown,
  CheckCircle2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeDialog({
  open,
  onOpenChange,
}: UpgradeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">

        <DialogHeader>

          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Crown className="h-8 w-8 text-primary" />
          </div>

          <DialogTitle className="text-center text-2xl">
            Unlock Unlimited Academic Resources
          </DialogTitle>

          <DialogDescription className="mx-auto max-w-sm text-center">
            Continue to securely upgrade your account and enjoy unlimited
            downloads, premium academic resources, an ad-free experience,
            priority support, and early access to new features.
          </DialogDescription>

        </DialogHeader>

        <div className="space-y-4 py-4">

          <Feature text="Unlimited downloads" />

          <Feature text="Premium academic resources" />

          <Feature text="No advertisements" />

          <Feature text="Priority support" />

          <Feature text="Early access to new features" />

          <Feature text="Premium member badge" />

        </div>

        <div className="rounded-xl border bg-primary/5 p-5 text-center">

          <div className="text-3xl font-bold">
            ₦3,000
          </div>

          <div className="text-sm text-muted-foreground">
            per month
          </div>

        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row">

          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Maybe Later
          </Button>

          <Button
            className="w-full"
            onClick={() => {
              // Flutterwave checkout will be added here.
            }}
          >
            Continue
          </Button>

        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

function Feature({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle2 className="h-5 w-5 text-green-600" />
      <span>{text}</span>
    </div>
  );
}