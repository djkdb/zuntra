import { CheckIcon } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
}

interface ChoiceGroupProps {
  legend: string;
  name: string;
  type: "checkbox" | "radio";
  options: ChoiceOption[];
  defaultValue?: string | string[];
  error?: string;
  hint?: string;
  optional?: boolean;
  /** "chips" for short multi-select tags, "cards" for options with descriptions. */
  variant?: "chips" | "cards";
  className?: string;
}

/**
 * Native checkbox/radio inputs styled as chips or cards: keyboard and screen-reader friendly,
 * and submits through plain FormData without client state.
 */
export function ChoiceGroup({
  legend,
  name,
  type,
  options,
  defaultValue,
  error,
  hint,
  optional,
  variant = "chips",
  className,
}: ChoiceGroupProps) {
  const id = useId();
  const defaults = new Set(Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : []);
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <fieldset
      className={cn("space-y-2", className)}
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-2 text-sm font-medium">
        {legend}
        {optional ? <span className="font-normal text-muted-foreground"> (선택)</span> : null}
      </legend>
      {hint ? (
        <p id={hintId} className="-mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <div className={cn(variant === "chips" ? "flex flex-wrap gap-2" : "grid gap-2 sm:grid-cols-3")}>
        {options.map((option) => (
          <label key={option.value} className="group relative cursor-pointer">
            <input
              type={type}
              name={name}
              value={option.value}
              defaultChecked={defaults.has(option.value)}
              className="peer sr-only"
            />
            {variant === "chips" ? (
              <span className="inline-flex h-10 items-center gap-1.5 rounded-md border bg-card px-3.5 text-sm md:h-8 md:px-3 transition-colors select-none group-hover:border-primary/40 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                <CheckIcon className="hidden size-3.5 group-has-[:checked]:block" aria-hidden />
                {option.label}
              </span>
            ) : (
              <span className="flex h-full flex-col rounded-md border bg-card p-3 transition-colors select-none group-hover:border-primary/40 peer-checked:border-primary peer-checked:bg-secondary peer-checked:ring-1 peer-checked:ring-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                <span className="font-medium">{option.label}</span>
                {option.description ? (
                  <span className="mt-1 text-xs text-muted-foreground">{option.description}</span>
                ) : null}
              </span>
            )}
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
