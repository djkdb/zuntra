import { CheckIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface NextStep {
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

/**
 * The overview's guide: what is left to do for this phase of the trip, in order, each a link to
 * the place where it gets done. Finished steps stay visible (checked) so progress is clear.
 */
export function NextSteps({ status, title, steps }: { status: string; title: string; steps: NextStep[] }) {
  const left = steps.filter((s) => !s.done).length;
  return (
    <section aria-labelledby="next-step" className="rounded-lg border bg-card">
      <div className="px-4 pt-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 rounded-full bg-sunset" aria-hidden />
          {status}
        </p>
        <h2 id="next-step" className="mt-1.5 font-semibold">
          {title}
          {steps.length > 0 ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">{left > 0 ? `${left}개 남음` : "모두 완료"}</span> : null}
        </h2>
      </div>
      <ol className="mt-3 divide-y border-t">
        {steps.map((step) => (
          <li key={step.label}>
            <Link href={step.href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  step.done && "border-success bg-success text-white",
                )}
                aria-hidden
              >
                {step.done ? <CheckIcon className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-medium", step.done && "text-muted-foreground line-through decoration-1")}>
                  {step.label}
                  <span className="sr-only">{step.done ? " (완료)" : " (할 일)"}</span>
                </span>
                {!step.done ? <span className="block text-xs text-muted-foreground">{step.hint}</span> : null}
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
