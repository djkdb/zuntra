import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/format";

export function MobileHeader({ user }: { user: { name: string | null; email: string } }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-lg lg:hidden">
      <Link href="/dashboard" aria-label="TripMate 홈">
        <Logo />
      </Link>
      <Link href="/settings" aria-label="설정">
        <Avatar className="size-8">
          <AvatarFallback className="bg-secondary text-sm font-semibold text-secondary-foreground">
            {initialsOf(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
      </Link>
    </header>
  );
}
