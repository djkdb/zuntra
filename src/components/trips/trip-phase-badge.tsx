import { Badge } from "@/components/ui/badge";
import type { TripPhase } from "@/lib/dates";
import { PHASE_LABELS } from "@/lib/trips";
import { cn } from "@/lib/utils";

const TONE: Record<TripPhase, string> = {
  ongoing: "bg-success/15 text-success",
  upcoming: "bg-secondary text-secondary-foreground",
  past: "bg-muted text-muted-foreground",
  completed: "bg-muted text-muted-foreground",
};

export function TripPhaseBadge({ phase, className }: { phase: TripPhase; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("rounded-full", TONE[phase], className)}>
      {phase === "ongoing" ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {PHASE_LABELS[phase]}
    </Badge>
  );
}
