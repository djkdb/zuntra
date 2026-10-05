import { useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  optional?: boolean;
  className?: string;
  /** Receives the ids to wire onto the control for labelling and error announcement. */
  children: (control: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode;
}

export function Field({ label, error, hint, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional ? <span className="font-normal text-muted-foreground">(선택)</span> : null}
      </Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ message, tone = "error" }: { message?: string; tone?: "error" | "success" }) {
  if (!message) return null;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2.5 text-sm",
        tone === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
      )}
    >
      {message}
    </div>
  );
}
