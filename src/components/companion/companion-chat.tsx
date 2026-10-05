"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocateFixedIcon, LocateIcon, RotateCwIcon, SendIcon, SparklesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { itineraryKey } from "@/components/plan/use-itinerary";
import type { ChatMessageView } from "@/lib/ai-actions";
import { trackClient } from "@/lib/analytics-client";
import { ApiError, apiFetch, errorMessage } from "@/lib/api-client";
import type { DayView } from "@/lib/itinerary";
import { cn } from "@/lib/utils";
import { ActionCard } from "./action-card";

type Conversation = { messages: ChatMessageView[]; canEdit: boolean };

const STARTERS = ["지금 너무 피곤해", "여기 너무 좋다. 1시간 더 있을래", "밥 먹고 어디 가지?", "비 오면 어떡하지?", "예산 얼마나 썼어?"];

function useGeolocation(enabled: boolean) {
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null);
  return async (): Promise<{ lat: number; lng: number } | null> => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) return null;
    if (last.current && Date.now() - last.current.at < 120_000) return last.current;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          last.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() };
          resolve(last.current);
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 120_000 },
      );
    });
  };
}

export function CompanionChat({
  tripId,
  currency,
  initial,
  autoSend,
}: {
  tripId: string;
  currency: string;
  initial: Conversation;
  /** Sent once on mount (e.g. from a rain warning: "Day 3 오후에 비가 와요…"). */
  autoSend?: { message: string; focusDayId?: string };
}) {
  const qc = useQueryClient();
  const key = ["companion", tripId] as const;
  const { data } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiFetch<Conversation>(`/api/trips/${tripId}/companion`, { signal }),
    initialData: initial,
  });
  const [draft, setDraft] = useState("");
  const [shareLocation, setShareLocation] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const getLocation = useGeolocation(shareLocation);
  const listEnd = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: async ({ message, focusDayId }: { message: string; focusDayId?: string }) => {
      const location = await getLocation();
      return apiFetch<{ messages: ChatMessageView[] }>(`/api/trips/${tripId}/companion`, {
        method: "POST",
        body: { message, location, focusDayId },
      });
    },
    onMutate: async ({ message }) => {
      setFailed(null);
      await qc.cancelQueries({ queryKey: key });
      const optimistic: ChatMessageView = {
        id: `pending-${Date.now()}`,
        role: "USER",
        content: message,
        createdAt: new Date().toISOString(),
        quickReplies: [],
        actions: [],
      };
      qc.setQueryData<Conversation>(key, (c) => (c ? { ...c, messages: [...c.messages, optimistic] } : c));
      return { optimisticId: optimistic.id };
    },
    onSuccess: (result, _message, ctx) => {
      qc.setQueryData<Conversation>(key, (c) =>
        c ? { ...c, messages: [...c.messages.filter((m) => m.id !== ctx?.optimisticId), ...result.messages] } : c,
      );
    },
    onError: (error, { message }, ctx) => {
      qc.setQueryData<Conversation>(key, (c) => (c ? { ...c, messages: c.messages.filter((m) => m.id !== ctx?.optimisticId) } : c));
      setFailed(message);
      if (!(error instanceof ApiError && error.code === "VALIDATION")) toast.error(errorMessage(error));
    },
  });

  const decide = useMutation({
    mutationFn: ({ actionId, decision }: { actionId: string; decision: "approve" | "reject" }) =>
      apiFetch<{ status: "EXECUTED" | "REJECTED"; days: DayView[] }>(`/api/trips/${tripId}/actions/${actionId}`, {
        method: "POST",
        body: { decision },
      }),
    onSuccess: (result, { actionId }) => {
      qc.setQueryData<Conversation>(key, (c) =>
        c
          ? {
              ...c,
              messages: c.messages.map((m) => ({
                ...m,
                actions: m.actions.map((a) => (a.id === actionId ? { ...a, status: result.status } : a)),
              })),
            }
          : c,
      );
      if (result.status === "EXECUTED") {
        toast.success("일정에 반영했어요.");
        qc.invalidateQueries({ queryKey: itineraryKey(tripId) });
        qc.invalidateQueries({ queryKey: ["today", tripId] });
      }
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const messages = data?.messages ?? [];
  const canEdit = data?.canEdit ?? false;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "ASSISTANT");

  const autoSent = useRef(false);
  useEffect(() => {
    if (!autoSend || autoSent.current) return;
    autoSent.current = true;
    send.mutate(autoSend);
    // Drop ?q= so a refresh does not resend.
    window.history.replaceState(null, "", window.location.pathname);
  }, [autoSend, send]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, send.isPending]);

  const submit = (text: string, source: "typed" | "quick_reply" | "starter" = "typed") => {
    const message = text.trim();
    if (!message || send.isPending) return;
    if (source !== "typed") trackClient("ai_suggestion_clicked", { tripId, properties: { source } });
    setDraft("");
    send.mutate({ message });
  };

  return (
    <div className="flex min-h-[60dvh] flex-col">
      <div className="flex-1 space-y-5 pb-4" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed px-5 py-10 text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <SparklesIcon className="size-6" aria-hidden />
            </span>
            <h2 className="text-lg font-semibold">무엇이든 물어보세요</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              지금 시간, 남은 일정, 날씨와 예산을 알고 대답해요. 일정 변경은 확인을 받은 뒤에만 적용돼요.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s, "starter")}
                  className="rounded-full border bg-card px-3.5 py-2 text-sm hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) =>
          m.role === "USER" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg rounded-br-md bg-primary px-4 py-2.5 whitespace-pre-line text-primary-foreground">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary" aria-hidden>
                <SparklesIcon className="size-4" />
              </span>
              <div className="min-w-0 max-w-[85%] space-y-2.5">
                <p className="rounded-lg rounded-tl-md bg-muted px-4 py-3 leading-relaxed whitespace-pre-line">{m.content}</p>
                {m.actions.map((a) => (
                  <ActionCard
                    key={a.id}
                    action={a}
                    currency={currency}
                    canEdit={canEdit}
                    pending={decide.isPending && decide.variables?.actionId === a.id}
                    onDecide={(decision) => decide.mutate({ actionId: a.id, decision })}
                  />
                ))}
                {m.id === lastAssistant?.id && m.quickReplies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {m.quickReplies.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => submit(q, "quick_reply")}
                        className="rounded-full border bg-card px-3.5 py-1.5 text-sm hover:bg-muted"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ),
        )}

        {send.isPending ? (
          <div className="flex gap-2.5" role="status">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary" aria-hidden>
              <SparklesIcon className="size-4" />
            </span>
            <p className="flex items-center gap-1.5 rounded-lg rounded-tl-md bg-muted px-4 py-3 text-sm text-muted-foreground">
              <span className="flex gap-1" aria-hidden>
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current" />
              </span>
              지금 상황을 확인하고 있어요
            </p>
          </div>
        ) : null}

        {failed ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            메시지를 보내지 못했어요.
            <Button size="sm" variant="outline" onClick={() => submit(failed)}>
              <RotateCwIcon data-icon="inline-start" aria-hidden />
              다시 보내기
            </Button>
          </div>
        ) : null}
        <div ref={listEnd} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="sticky bottom-20 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border lg:bottom-4"
      >
        <label htmlFor="companion-input" className="sr-only">
          AI에게 메시지 보내기
        </label>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={shareLocation}
            aria-label={shareLocation ? "현재 위치 공유 끄기" : "현재 위치 공유하기"}
            onClick={() => setShareLocation((v) => !v)}
            className={cn(shareLocation && "text-primary")}
          >
            {shareLocation ? <LocateFixedIcon /> : <LocateIcon />}
          </Button>
          <textarea
            id="companion-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(draft);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="예: 지금 너무 피곤해"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border bg-card px-3.5 py-2.5 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          />
          <Button type="submit" size="icon" aria-label="보내기" disabled={!draft.trim() || send.isPending}>
            <SendIcon />
          </Button>
        </div>
        {shareLocation ? (
          <p className="mt-1.5 pl-12 text-xs text-muted-foreground">메시지를 보낼 때만 현재 위치를 사용하고 저장하지 않아요.</p>
        ) : null}
      </form>
    </div>
  );
}
