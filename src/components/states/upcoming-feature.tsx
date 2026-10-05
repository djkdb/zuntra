import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Honest placeholder for a trip section that ships in a later phase.
 * No fake data — it explains what the section will do and links back to working features.
 */
export function UpcomingFeature({
  icon: Icon,
  title,
  description,
  points,
  tripId,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
  tripId: string;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-lg border border-dashed px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="text-xs font-medium text-muted-foreground">곧 제공돼요</p>
      <h2 className="mt-2 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" className="mt-8">
        <Link href={`/trips/${tripId}`}>여행 개요로 돌아가기</Link>
      </Button>
    </section>
  );
}
