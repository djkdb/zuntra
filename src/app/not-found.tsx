import { CompassIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
        <CompassIcon className="size-7" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-bold">길을 잃었어요</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        페이지가 없거나 접근할 수 없는 여행이에요. 주소를 다시 확인해 주세요.
      </p>
      <Button asChild className="mt-8">
        <Link href="/dashboard">대시보드로 가기</Link>
      </Button>
    </main>
  );
}
