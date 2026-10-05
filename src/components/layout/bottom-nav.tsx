"use client";

import { CalendarRangeIcon, HomeIcon, MapIcon, MenuIcon, SparklesIcon } from "lucide-react";
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
    {
      href: "/settings",
      label: "더보기",
      icon: MenuIcon,
      active: pathname.startsWith("/settings") || /\/(budget|packing|journal)$/.test(pathname),
    },
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
      </ul>
    </nav>
  );
}
