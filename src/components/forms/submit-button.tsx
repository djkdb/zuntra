"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingLabel?: string;
  /** For forms submitted through a transition (onSubmit), where useFormStatus stays idle. */
  pending?: boolean;
};

export function SubmitButton({ children, pendingLabel, disabled, pending: pendingProp, ...props }: SubmitButtonProps) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" disabled={pending || disabled} aria-disabled={pending || disabled} {...props}>
      {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
