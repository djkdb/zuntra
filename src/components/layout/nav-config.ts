import {
  BookHeartIcon,
  CalendarRangeIcon,
  HomeIcon,
  LuggageIcon,
  MapIcon,
  type LucideIcon,
  PackageCheckIcon,
  SparklesIcon,
  WalletIcon,
  InfoIcon,
} from "lucide-react";

export interface TripNavItem {
  segment: string;
  label: string;
  icon: LucideIcon;
}

/** Sections inside a trip. `segment` "" is the overview. */
export const TRIP_SECTIONS: TripNavItem[] = [
  { segment: "", label: "개요", icon: InfoIcon },
  { segment: "plan", label: "일정", icon: CalendarRangeIcon },
  { segment: "map", label: "지도", icon: MapIcon },
  { segment: "companion", label: "AI 동행", icon: SparklesIcon },
  { segment: "budget", label: "경비", icon: WalletIcon },
  { segment: "packing", label: "준비물", icon: PackageCheckIcon },
  { segment: "journal", label: "기록", icon: BookHeartIcon },
];

export const MAIN_NAV = [
  { href: "/dashboard", label: "홈", icon: HomeIcon },
  { href: "/trips", label: "내 여행", icon: LuggageIcon },
] as const;

/** The trip id in the current URL, if any (`/trips/:id/...`). */
export function tripIdFromPath(pathname: string): string | null {
  const match = /^\/trips\/([^/]+)/.exec(pathname);
  if (!match || match[1] === "new") return null;
  return match[1] ?? null;
}
