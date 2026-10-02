"use client";

import { PlusIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { formatDDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { MAIN_NAV, TRIP_SECTIONS } from "./nav-config";
import { UserMenu } from "./user-menu";

export interface SidebarTrip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  phase: "upcoming" | "ongoing" | "past" | "completed";
  today: string;
}

export function AppSidebar({
  user,
  focusTrip,
}: {
  user: { name: string | null; email: string };
  focusTrip: SidebarTrip | null;
}) {
  const pathname = usePathname();
  const linkClass = (active: boolean) =>
    cn(
      "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      active && "bg-sidebar-accent text-sidebar-accent-foreground",
    );

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar px-3 py-5 lg:flex">
      <Link href="/dashboard" className="px-3">
        <Logo />
      </Link>

      <Button asChild className="mx-1 mt-7">
        <Link href="/trips/new">
          <PlusIcon data-icon="inline-start" aria-hidden />새 여행 만들기
        </Link>
      </Button>

      <nav aria-label="주요 메뉴" className="mt-6 space-y-1">
        {MAIN_NAV.map((item) => {
          const active = item.href === "/trips" ? pathname === "/trips" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={linkClass(active)} aria-current={active ? "page" : undefined}>
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {focusTrip ? (
        <section aria-labelledby="sidebar-trip" className="mt-8">
          <div className="px-3">
            <p className="text-xs font-medium text-muted-foreground">
              {focusTrip.phase === "ongoing" ? "여행 중" : `다가오는 여행 · ${formatDDay(focusTrip.startDate, focusTrip.today)}`}
            </p>
            <p id="sidebar-trip" className="mt-1 truncate font-semibold">
              {focusTrip.title}
            </p>
          </div>
          <ul className="mt-2 space-y-0.5">
            {TRIP_SECTIONS.map((section) => {
              const href = `/trips/${focusTrip.id}${section.segment ? `/${section.segment}` : ""}`;
              const active = pathname === href;
              return (
                <li key={section.segment}>
                  <Link href={href} className={linkClass(active)} aria-current={active ? "page" : undefined}>
                    <section.icon className="size-4" aria-hidden />
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mt-auto space-y-1">
        <Link href="/settings" className={linkClass(pathname.startsWith("/settings"))}>
          <SettingsIcon className="size-4" aria-hidden />
          설정
        </Link>
        <UserMenu name={user.name} email={user.email} />
      </div>
    </aside>
  );
}
