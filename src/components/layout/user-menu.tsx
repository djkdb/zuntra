"use client";

import { LogOutIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsOf } from "@/lib/format";
import { clearLocalTripData } from "@/components/offline";

export function UserMenu({ name, email, compact }: { name: string | null; email: string; compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="계정 메뉴"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-secondary text-sm font-semibold text-secondary-foreground">
            {initialsOf(name, email)}
          </AvatarFallback>
        </Avatar>
        {compact ? null : (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name ?? "여행자"}</span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon aria-hidden />
            설정
          </Link>
        </DropdownMenuItem>
        <form action={signOutAction} onSubmit={() => clearLocalTripData()}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOutIcon aria-hidden />
              로그아웃
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
