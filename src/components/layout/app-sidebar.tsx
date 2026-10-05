"use client";

import { BarChart3Icon, PlusIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { formatDDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { MAIN_NAV, TRIP_SECTIONS, tripIdFromPath } from "./nav-config";
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
  user: { name: string | null; email: string; isAdmin?: boolean };
  focusTrip: SidebarTrip | null;
}) {
  const pathname = usePathname();
  const linkClass = (active: boolean) =>
    cn(
      "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
    );

  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-sidebar px-2.5 py-4 lg:flex">
      <Link href="/dashboard" className="px-2.5">
        <Logo />
      </Link>

      <Button asChild size="sm" className="mt-5 justify-start">
        <Link href="/trips/new">
          <PlusIcon data-icon="inline-start" aria-hidden />새 여행 만들기
        </Link>
      </Button>

      <nav aria-label="주요 메뉴" className="mt-4 space-y-px">
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

      {/* On a trip's own pages the tab bar already lists these sections; showing them twice only
          doubled the tab stops. Elsewhere this is the shortcut into the current trip. */}
      {focusTrip && !tripIdFromPath(pathname) ? (
        <section aria-labelledby="sidebar-trip" className="mt-6">
          <div className="px-2.5">
            <p className="text-xs text-muted-foreground">
              {focusTrip.phase === "ongoing" ? "여행 중" : `다가오는 여행 · ${formatDDay(focusTrip.startDate, focusTrip.today)}`}
            </p>
            <p id="sidebar-trip" className="mt-0.5 truncate text-sm font-semibold">
              {focusTrip.title}
            </p>
          </div>
          <ul className="mt-1.5 space-y-px">
            {TRIP_SECTIONS.map((section) => {
              const href = `/trips/${focusTrip.id}${section.segment ? `/${section.segment}` : ""}`;
              const active = pathname === href;
              return (
                <li key={section.segment}>
                  <Link
                    href={href}
                    className={linkClass(active)}
                    aria-current={active ? "page" : undefined}
                    prefetch
                  >
                    <section.icon className="size-4" aria-hidden />
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mt-auto space-y-px">
        {user.isAdmin ? (
          <Link href="/admin" className={linkClass(pathname.startsWith("/admin"))}>
            <BarChart3Icon className="size-4" aria-hidden />
            관리자
          </Link>
        ) : null}
        <Link href="/settings" className={linkClass(pathname.startsWith("/settings"))}>
          <SettingsIcon className="size-4" aria-hidden />
          설정
        </Link>
        <UserMenu name={user.name} email={user.email} />
      </div>
    </aside>
  );
}
