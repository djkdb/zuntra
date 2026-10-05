import { CloudRainIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { RainSuggestion } from "@/lib/weather";

/** Weather tied to the plan: "Day 3 오후에 비가 예상됩니다. 실내 일정으로 변경할까요?" */
export function RainBanner({ tripId, suggestion, canEdit }: { tripId: string; suggestion: RainSuggestion; canEdit: boolean }) {
  const prompt = `Day ${suggestion.dayNumber} 오후에 비가 예상돼요. ${suggestion.outdoorTitles[0]} 같은 야외 일정을 실내 일정으로 바꿔줄래?`;
  const href = `/trips/${tripId}/companion?q=${encodeURIComponent(prompt)}&day=${suggestion.dayId}`;
  return (
    <div role="status" className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-secondary/60 p-4 sm:flex-row sm:items-center">
      <CloudRainIcon className="size-6 shrink-0 text-primary" aria-hidden />
      <div className="flex-1">
        <p className="font-semibold">{suggestion.message}</p>
        <p className="text-sm text-muted-foreground">
          야외 일정({suggestion.outdoorTitles.slice(0, 2).join(", ")}
          {suggestion.outdoorTitles.length > 2 ? ` 외 ${suggestion.outdoorTitles.length - 2}곳` : ""}) 대신 실내 일정으로 변경할까요?
        </p>
      </div>
      {canEdit ? (
        <Button asChild size="sm">
          <Link href={href}>실내 일정 제안받기</Link>
        </Button>
      ) : null}
    </div>
  );
}
