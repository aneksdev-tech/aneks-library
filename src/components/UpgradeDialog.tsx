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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <div className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 sm:mb-2 sm:h-13 sm:w-13">
            <Crown className="h-6 w-6 text-yellow-500 sm:h-8 sm:w-8" />
          </div>

          <DialogTitle className="text-left text-lg sm:text-2xl">
            Unlock Unlimited Academic Resources
          </DialogTitle>

          <DialogDescription className="mx-auto max-w-sm text-left text-xs leading-5 sm:text-sm sm:leading-6">
            Continue to securely upgrade your account and enjoy unlimited
            downloads, premium academic resources, an ad-free experience,
            priority support, and early access to new features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-1.5 sm:space-y-2 sm:py-2">
          <Feature text="Unlimited downloads" />
          <Feature text="Premium academic resources" />
          <Feature text="No advertisements" />
          <Feature text="Priority support" />
          <Feature text="Early access to new features" />
          <Feature text="Premium member badge" />
        </div>

        <div className="rounded-lg border bg-primary/5 p-3 text-left sm:rounded-xl sm:p-4">
          <p className="text-2xl font-bold sm:text-3xl">
            ₦3,000
            <span className="text-base font-normal sm:text-lg">
              /month
            </span>
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-3">
          <Button
            variant="outline"
            className="h-9 w-full text-xs sm:h-10 sm:text-sm"
            onClick={() => onOpenChange(false)}
          >
            Maybe Later
          </Button>

          <Button
            className="h-9 w-full text-xs sm:h-10 sm:text-sm"
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
    <div className="flex items-center gap-2.5 sm:gap-3">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 sm:h-5 sm:w-5" />
      <span className="text-xs sm:text-sm">
        {text}
      </span>
    </div>
  );
}