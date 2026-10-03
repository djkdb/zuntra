"use client";

import { LogOutIcon } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { clearLocalTripData } from "@/components/offline";
import { Button } from "@/components/ui/button";

export function SignOutButton({ variant = "outline", className }: { variant?: "outline" | "ghost"; className?: string }) {
  return (
    <form action={signOutAction} onSubmit={() => clearLocalTripData()}>
      <Button type="submit" variant={variant} className={className}>
        <LogOutIcon data-icon="inline-start" aria-hidden />
        로그아웃
      </Button>
    </form>
  );
}
