import { WifiOffIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "오프라인", robots: { index: false } };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
        <WifiOffIcon className="size-7" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold">인터넷에 연결되어 있지 않아요</h1>
      <p className="mt-2 text-muted-foreground">
        한 번이라도 열어 본 여행 화면은 오프라인에서도 볼 수 있어요. 연결되면 다시 시도해 주세요.
      </p>
    </div>
  );
}
