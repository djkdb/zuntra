import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" aria-label="TripMate 홈">
            <Logo />
          </Link>
          <nav aria-label="사이트 메뉴" className="flex items-center gap-1 sm:gap-2">
            <Link href="/demo" className="hidden h-10 items-center px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
              데모
            </Link>
            <Button asChild variant="ghost">
              <Link href="/login">로그인</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">시작하기</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} TripMate</p>
          <p>여행 전 · 여행 중 · 여행 후를 하나의 흐름으로.</p>
        </div>
      </footer>
    </div>
  );
}
