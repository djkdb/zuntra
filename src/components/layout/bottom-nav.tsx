"use client";

import {
  CalendarRangeIcon,
  HomeIcon,
  MapIcon,
  MenuIcon,
  NotebookPenIcon,
  PackageCheckIcon,
  PlusIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { tripIdFromPath } from "./nav-config";

/**
 * Mobile tab bar: 홈 · 일정 · 지도 · AI · 더보기.
 * Trip-scoped tabs follow the trip in the URL, else the focus (ongoing/next) trip.
 */
export function BottomNav({ focusTripId }: { focusTripId: string | null }) {
  const pathname = usePathname();
  const tripId = tripIdFromPath(pathname) ?? focusTripId;
  const tripHref = (segment: string) => (tripId ? `/trips/${tripId}/${segment}` : "/trips");

  const items = [
    { href: "/dashboard", label: "홈", icon: HomeIcon, active: pathname === "/dashboard" },
    {
      href: tripId ? tripHref("plan") : "/trips",
      label: "일정",
      icon: CalendarRangeIcon,
      active: pathname === "/trips" || /^\/trips\/[^/]+(\/plan)?$/.test(pathname),
    },
    { href: tripHref("companion"), label: "AI", icon: SparklesIcon, active: pathname.endsWith("/companion"), primary: true },
    { href: tripHref("map"), label: "지도", icon: MapIcon, active: pathname.endsWith("/map") },
  ];
  const moreActive = pathname.startsWith("/settings") || /\/(budget|packing|journal|report|members)$/.test(pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  // The rest of a trip's sections live behind "더보기", next to settings.
  const more = [
    ...(tripId
      ? [
          { href: tripHref("budget"), label: "경비", icon: WalletIcon },
          { href: tripHref("packing"), label: "준비물", icon: PackageCheckIcon },
          { href: tripHref("journal"), label: "기록", icon: NotebookPenIcon },
          { href: tripHref("members"), label: "일행 초대", icon: UsersIcon },
        ]
      : []),
    { href: "/trips/new", label: "새 여행", icon: PlusIcon },
    { href: "/settings", label: "설정", icon: SettingsIcon },
  ];

  return (
    <nav
      aria-label="주요 메뉴"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-lg supports-[backdrop-filter]:bg-background/75 lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map((item) => (
          <li key={item.label} className="flex">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              prefetch
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors",
                item.active && "text-primary",
              )}
            >
              {item.primary ? (
                <span
                  className={cn(
                    "-mt-5 flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-4 ring-background transition-transform active:scale-95",
                  )}
                >
                  <item.icon className="size-5" aria-hidden />
                </span>
              ) : (
                <item.icon className="size-5" aria-hidden />
              )}
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
        <li className="flex">
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-current={moreActive ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors",
              moreActive && "text-primary",
            )}
          >
            <MenuIcon className="size-5" aria-hidden />
            <span>더보기</span>
          </button>
        </li>
      </ul>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-safe rounded-t-xl" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>더보기</SheetTitle>
          </SheetHeader>
          <ul className="grid grid-cols-4 gap-2 px-4 pb-6">
            {more.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  prefetch
                  onClick={() => setMoreOpen(false)}
                  aria-current={pathname === m.href ? "page" : undefined}
                  className="flex flex-col items-center gap-1.5 rounded-lg border bg-card py-3 text-xs font-medium aria-[current=page]:border-foreground"
                >
                  <m.icon className="size-5 text-muted-foreground" aria-hidden />
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
