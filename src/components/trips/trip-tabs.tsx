"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { FileTextIcon } from "lucide-react";
import { TRIP_SECTIONS } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";

export function TripTabs({ tripId, completed }: { tripId: string; completed?: boolean }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  // On narrow screens the strip scrolls; keep the current tab in view.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    nav.scrollTo({ left: active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
  }, [pathname]);
  return (
    <nav
      ref={navRef}
      aria-label="여행 메뉴"
      // The faded right edge says "more tabs this way" on phones.
      className="-mx-4 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [scrollbar-width:none] sm:mx-0 sm:px-0 sm:[mask-image:none]"
    >
      <ul className="flex min-w-max gap-1 border-b">
        {[...TRIP_SECTIONS, ...(completed ? [{ segment: "report", label: "리포트", icon: FileTextIcon }] : [])].map((section) => {
          const href = `/trips/${tripId}${section.segment ? `/${section.segment}` : ""}`;
          const active = pathname === href;
          return (
            <li key={section.segment}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                // Full prefetch (not just the loading shell): switching tabs then renders at once
                // instead of flashing the skeleton while the server responds.
                prefetch
                className={cn(
                  "relative inline-flex h-10 items-center gap-1.5 px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active &&
                    "text-foreground after:absolute after:inset-x-1.5 after:-bottom-px after:h-0.5 after:bg-foreground",
                )}
              >
                <section.icon className="size-4" aria-hidden />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
