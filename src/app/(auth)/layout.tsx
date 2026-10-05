import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="relative">
          <Logo />
        </Link>
        <div className="relative max-w-md space-y-4">
          <p className="text-3xl leading-snug font-semibold">
            여행을 계획하는 게 아니라,
            <br />
            여행을 함께 준비하세요.
          </p>
          <p className="text-primary-foreground/75">
            일정, 이동, 날씨, 예산, 그리고 여행 중 생기는 모든 변수까지. TripMate가 지금 무엇을 하면 좋을지
            알려드려요.
          </p>
        </div>
        <p className="relative text-sm text-primary-foreground/60">계획부터 여행 중 조정, 다녀온 뒤 기록까지 한 곳에서.</p>
      </aside>
      <main id="main" className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="mb-10 lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-10">{children}</div>
      </main>
    </div>
  );
}
