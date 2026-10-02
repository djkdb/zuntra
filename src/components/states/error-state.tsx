"use client";

import { CloudOffIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "정보를 가져오지 못했습니다.",
  description = "네트워크 상태를 확인하고 다시 시도해 주세요.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center", className)}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <CloudOffIcon className="size-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-6" onClick={onRetry}>
          <RotateCwIcon data-icon="inline-start" />
          다시 시도
        </Button>
      ) : null}
    </div>
  );
}
