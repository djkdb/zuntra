"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, Loader2Icon, PackageCheckIcon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { focusAfterRemoval } from "@/lib/focus";
import { cn } from "@/lib/utils";
import type { PackingData, PackingItemView } from "@/server/services/packing-service";
import { useSeededQuery } from "@/components/use-seeded-query";

const GROUPS = ["필수 서류", "기본", "전자기기", "의류", "세면·건강", "날씨", "맞춤"];

export function PackingClient({ tripId, initialData }: { tripId: string; initialData: PackingData }) {
  const qc = useQueryClient();
  const key = ["packing", tripId] as const;
  const { data = initialData } = useSeededQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiFetch<PackingData>(`/api/trips/${tripId}/packing`, { signal }),
    initialData,
  });
  const [name, setName] = useState("");
  const [group, setGroup] = useState("기본");

  const onError = (e: unknown) => {
    toast.error(errorMessage(e));
    qc.invalidateQueries({ queryKey: key });
  };
  const set = (next: PackingData) => qc.setQueryData(key, next);

  const toggle = useMutation({
    mutationFn: (item: PackingItemView) =>
      apiFetch<PackingData>(`/api/trips/${tripId}/packing/${item.id}`, { method: "PATCH", body: { isPacked: !item.isPacked } }),
    onMutate: (item) =>
      qc.setQueryData<PackingData>(key, (d) => d && { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, isPacked: !i.isPacked } : i)) }),
    onSuccess: set,
    onError,
  });
  // Shows the new item at once (like check/delete) and clears the field for the next one.
  const add = useMutation({
    mutationFn: (vars: { name: string; group: string }) =>
      apiFetch<PackingData>(`/api/trips/${tripId}/packing`, { method: "POST", body: vars }),
    onMutate: (vars) => {
      setName("");
      qc.setQueryData<PackingData>(key, (d) =>
        d && {
          ...d,
          items: [...d.items, { id: `pending-${Date.now()}`, name: vars.name, group: vars.group, quantity: 1, isPacked: false, reason: null, source: "USER" }],
        },
      );
    },
    onSuccess: set,
    onError: (e, vars) => {
      setName(vars.name);
      onError(e);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<PackingData>(`/api/trips/${tripId}/packing/${id}`, { method: "DELETE" }),
    onMutate: (id) => qc.setQueryData<PackingData>(key, (d) => d && { ...d, items: d.items.filter((i) => i.id !== id) }),
    onSuccess: set,
    onError,
  });
  const generate = useMutation({
    mutationFn: () => apiFetch<PackingData & { added: number }>(`/api/trips/${tripId}/packing/generate`, { method: "POST", body: {} }),
    onSuccess: (next) => {
      set(next);
      toast.success(next.added > 0 ? `준비물 ${next.added}개를 추가했어요.` : "추가할 준비물이 없어요. 이미 잘 챙기셨어요!");
    },
    onError,
  });

  const items = data.items;
  const packed = items.filter((i) => i.isPacked).length;
  const pct = items.length ? Math.round((packed / items.length) * 100) : 0;
  const groups = [...GROUPS, ...new Set(items.map((i) => i.group).filter((g) => !GROUPS.includes(g)))]
    .map((g) => ({ name: g, items: items.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-48 flex-1 lg:max-w-md">
          <h2 className="text-lg font-semibold">준비물</h2>
          {items.length > 0 ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                {items.length}개 중 {packed}개 챙김 · {pct}%
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/12" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="준비물 챙김 진행률">
                <div className={cn("h-full rounded-full", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : null}
        </div>
        {data.canEdit ? (
          <Button variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : <SparklesIcon data-icon="inline-start" aria-hidden />}
            {generate.isPending ? "준비물을 고르고 있어요..." : "AI 준비물 추천"}
          </Button>
        ) : null}
      </div>

      {data.canEdit ? (
        <form
          className="flex max-w-2xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) add.mutate({ name: name.trim(), group });
          }}
        >
          <label htmlFor="packing-name" className="sr-only">
            준비물 이름
          </label>
          <Input id="packing-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="예: 여권 사본, 동전지갑" className="flex-1" />
          <div className="w-32 shrink-0">
            <label htmlFor="packing-group" className="sr-only">
              분류
            </label>
            <NativeSelect id="packing-group" value={group} onChange={(e) => setGroup(e.target.value)}>
              {GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" size="icon" aria-label="준비물 추가" disabled={!name.trim()}>
            <PlusIcon />
          </Button>
        </form>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={PackageCheckIcon}
          title="준비물 체크리스트를 만들어 보세요"
          description="여행지, 기간, 날씨와 취향에 맞춰 AI가 필요한 준비물을 골라 드려요."
          action={
            data.canEdit ? (
              <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
                <SparklesIcon data-icon="inline-start" aria-hidden />
                AI로 체크리스트 만들기
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="columns-1 gap-5 lg:columns-2 2xl:columns-3 [&>section]:mb-5 [&>section]:break-inside-avoid">
        {groups.map((g) => (
          <section key={g.name} aria-labelledby={`group-${g.name}`}>
            <h3 id={`group-${g.name}`} className="mb-2 text-sm font-semibold text-muted-foreground">
              {g.name} <span className="font-normal">{g.items.filter((i) => i.isPacked).length}/{g.items.length}</span>
            </h3>
            <ul className="divide-y rounded-lg border bg-card">
              {g.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.isPacked}
                    aria-label={`${item.name} 챙김`}
                    disabled={!data.canEdit || item.id.startsWith("pending-")}
                    onClick={() => toggle.mutate(item)}
                    className={cn(
                      "relative flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors after:absolute after:-inset-2.5",
                      item.isPacked ? "border-success bg-success text-white" : "border-border hover:border-primary",
                    )}
                  >
                    {item.isPacked ? <CheckIcon className="size-3.5" strokeWidth={3} /> : null}
                  </button>
                  <span className="min-w-0 flex-1 py-1">
                    <span className={cn("block", item.isPacked && "text-muted-foreground line-through decoration-1")}>
                      {item.name}
                      {item.quantity > 1 ? <span className="ml-1.5 text-sm text-muted-foreground">×{item.quantity}</span> : null}
                    </span>
                    {item.reason ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {item.source === "AI" ? <SparklesIcon className="size-3 text-primary" aria-label="AI 추천" /> : null}
                        {item.reason}
                      </span>
                    ) : null}
                  </span>
                  {data.canEdit ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${item.name} 삭제`}
                      disabled={item.id.startsWith("pending-")}
                      className="max-sm:size-10"
                      onClick={(e) => {
                        const restoreFocus = focusAfterRemoval(e.currentTarget.closest("li"));
                        remove.mutate(item.id);
                        restoreFocus();
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
        </div>
      )}
    </div>
  );
}
