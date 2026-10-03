"use client";

import { Loader2Icon, RefreshCwIcon, RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/api-client";

export function ReportActions({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, message: string) =>
    start(async () => {
      try {
        await fn();
        toast.success(message);
        router.refresh();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => run(() => apiFetch(`/api/trips/${tripId}/report`, { method: "POST", body: {} }), "리포트를 새로 만들었어요.")}
      >
        {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : <RefreshCwIcon data-icon="inline-start" aria-hidden />}
        리포트 다시 만들기
      </Button>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() =>
          run(async () => {
            await apiFetch(`/api/trips/${tripId}/complete`, { method: "DELETE" });
            router.push(`/trips/${tripId}`);
          }, "여행을 다시 열었어요.")
        }
      >
        <RotateCcwIcon data-icon="inline-start" aria-hidden />
        여행 다시 열기
      </Button>
    </div>
  );
}
