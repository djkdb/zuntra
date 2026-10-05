"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileTextIcon } from "lucide-react";
import { TRIP_SECTIONS } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";

export function TripTabs({ tripId, completed }: { tripId: string; completed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="여행 메뉴" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {[...TRIP_SECTIONS, ...(completed ? [{ segment: "report", label: "리포트", icon: FileTextIcon }] : [])].map((section) => {
          const href = `/trips/${tripId}${section.segment ? `/${section.segment}` : ""}`;
          const active = pathname === href;
          return (
            <li key={section.segment}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
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
