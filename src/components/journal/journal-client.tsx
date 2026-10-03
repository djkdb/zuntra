"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookHeartIcon, FlagIcon, Loader2Icon, MapPinIcon, StarIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/states/empty-state";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatShortDate, todayInTimeZone } from "@/lib/dates";
import { type JournalEntryView, MOOD_OPTIONS } from "@/lib/journal";
import type { JournalData } from "@/server/services/journal-service";
import { JournalComposer } from "./journal-composer";

export function JournalClient({ tripId, initialData }: { tripId: string; initialData: JournalData }) {
  const qc = useQueryClient();
  const router = useRouter();
  const key = ["journal", tripId] as const;
  const { data = initialData } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiFetch<JournalData>(`/api/trips/${tripId}/journal`, { signal }),
    initialData,
  });
  const [confirmEnd, setConfirmEnd] = useState(false);

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<JournalData>(`/api/trips/${tripId}/journal/${id}`, { method: "DELETE" }),
    onSuccess: (next) => {
      qc.setQueryData(key, next);
      toast.success("기록을 삭제했어요.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const complete = useMutation({
    mutationFn: () => apiFetch(`/api/trips/${tripId}/complete`, { method: "POST", body: {} }),
    onSuccess: () => {
      toast.success("여행을 마쳤어요. 리포트를 만들었어요!");
      router.push(`/trips/${tripId}/report`);
      router.refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const today = todayInTimeZone(data.timezone);
  const defaultDate = data.days.find((d) => d.date === today)?.date ?? (today > data.endDate ? data.endDate : data.startDate);
  const grouped = data.entries.reduce<Record<string, JournalEntryView[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});
  const completed = data.status === "COMPLETED";
  const tripStarted = today >= data.startDate;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-8">
        {data.canEdit ? <JournalComposer tripId={tripId} data={data} defaultDate={defaultDate} onSaved={(next) => qc.setQueryData(key, next)} /> : null}

        {data.entries.length === 0 ? (
          <EmptyState
            icon={BookHeartIcon}
            title="아직 남긴 기록이 없어요"
            description="사진, 메모, 기분과 별점을 남기면 여행이 끝난 뒤 AI가 여행 리포트로 정리해 드려요."
          />
        ) : (
          Object.entries(grouped).map(([date, entries]) => (
            <section key={date} aria-labelledby={`j-${date}`} className="space-y-3">
              <h2 id={`j-${date}`} className="text-sm font-semibold text-muted-foreground">
                {entries[0]?.dayNumber ? `DAY ${entries[0].dayNumber} · ` : ""}
                {formatShortDate(date)}
              </h2>
              {entries.map((e) => (
                <article key={e.id} className="space-y-3 rounded-2xl border bg-card p-4">
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      {e.mood ? (
                        <span>
                          <span aria-hidden>{MOOD_OPTIONS.find((m) => m.value === e.mood)?.emoji}</span>{" "}
                          {MOOD_OPTIONS.find((m) => m.value === e.mood)?.label}
                        </span>
                      ) : null}
                      {e.rating ? (
                        <span className="inline-flex items-center gap-0.5" aria-label={`별점 ${e.rating}점`}>
                          {Array.from({ length: e.rating }, (_, i) => (
                            <StarIcon key={i} className="size-3.5 fill-sunset text-sunset" aria-hidden />
                          ))}
                        </span>
                      ) : null}
                      {e.place ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <MapPinIcon className="size-3.5" aria-hidden />
                          {e.place.name}
                        </span>
                      ) : null}
                    </div>
                    {data.canEdit && e.isMine ? (
                      <Button variant="ghost" size="icon-sm" aria-label="기록 삭제" onClick={() => remove.mutate(e.id)} disabled={remove.isPending}>
                        <Trash2Icon />
                      </Button>
                    ) : null}
                  </header>
                  <p className="leading-relaxed whitespace-pre-line">{e.content}</p>
                  {e.photos.length > 0 ? (
                    <ul className="grid grid-cols-3 gap-1.5">
                      {e.photos.map((p) => (
                        <li key={p.id}>
                          <Image
                            src={p.url}
                            alt={p.caption ?? `${e.place?.name ?? "여행"} 사진`}
                            width={p.width ?? 600}
                            height={p.height ?? 600}
                            // Private, auth-protected images: served by our API, not the optimizer.
                            unoptimized
                            loading="lazy"
                            className="aspect-square w-full rounded-xl object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </section>
          ))
        )}
      </div>

      <aside className="space-y-4">
        <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
          <FlagIcon className="size-6" aria-hidden />
          {completed ? (
            <>
              <h2 className="mt-3 text-lg font-semibold">여행을 마쳤어요</h2>
              <p className="mt-1 text-sm text-primary-foreground/80">기록과 사진, 지출을 모아 만든 여행 리포트를 확인해 보세요.</p>
              <Button asChild variant="secondary" className="mt-4 w-full">
                <Link href={`/trips/${tripId}/report`}>여행 리포트 보기</Link>
              </Button>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-lg font-semibold">여행을 마치셨나요?</h2>
              <p className="mt-1 text-sm text-primary-foreground/80">
                여행을 종료하면 장소·지출·기록을 정리한 AI 여행 리포트를 만들어 드려요.
              </p>
              {data.canEdit ? (
                <Button variant="secondary" className="mt-4 w-full" onClick={() => setConfirmEnd(true)} disabled={!tripStarted || complete.isPending}>
                  {complete.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
                  {complete.isPending ? "리포트를 만들고 있어요..." : "여행 종료하고 리포트 만들기"}
                </Button>
              ) : null}
              {!tripStarted ? <p className="mt-2 text-xs text-primary-foreground/70">여행이 시작된 뒤에 종료할 수 있어요.</p> : null}
            </>
          )}
        </section>
      </aside>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>여행을 종료할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              지금까지의 일정, 지출, 기록으로 여행 리포트를 만들어요. 나중에 기록을 더 남기고 리포트를 다시 만들 수도 있어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <Button
              onClick={() => {
                setConfirmEnd(false);
                complete.mutate();
              }}
            >
              여행 종료하기
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
