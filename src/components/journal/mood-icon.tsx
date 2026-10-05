import { BatteryLowIcon, FrownIcon, LaughIcon, LeafIcon, SmileIcon } from "lucide-react";
import type { Mood } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const ICONS = { AMAZING: LaughIcon, HAPPY: SmileIcon, CALM: LeafIcon, TIRED: BatteryLowIcon, SAD: FrownIcon } as const;

/** Mood as a line icon, matching the rest of the UI's icon set. */
export function MoodIcon({ mood, className }: { mood: Mood; className?: string }) {
  const Icon = ICONS[mood];
  return <Icon className={cn("size-4", className)} aria-hidden />;
}
