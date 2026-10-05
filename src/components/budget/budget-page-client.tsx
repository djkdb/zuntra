"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, Loader2Icon, PencilIcon, PlusIcon, SettingsIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/forms/field";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiError, apiFetch, errorMessage } from "@/lib/api-client";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseView } from "@/lib/budget";
import { formatShortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BudgetData } from "@/server/services/budget-service";
import { BudgetMeter, CategoryBars, DailyColumns } from "./budget-charts";

type ExpenseDialogState = { mode: "create" } | { mode: "edit"; expense: ExpenseView } | null;

export function BudgetPageClient({ tripId, initialData }: { tripId: string; initialData: BudgetData }) {
  const qc = useQueryClient();
  const key = ["budget", tripId] as const;
  const { data = initialData } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiFetch<BudgetData>(`/api/trips/${tripId}/budget`, { signal }),
    initialData,
  });
  const [expenseDialog, setExpenseDialog] = useState<ExpenseDialogState>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const { summary, expenses, canEdit } = data;

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<BudgetData>(`/api/trips/${tripId}/expenses/${id}`, { method: "DELETE" }),
    onSuccess: (next) => {
      qc.setQueryData(key, next);
      toast.success("지출을 삭제했어요.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const grouped = expenses.reduce<Record<string, ExpenseView[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">{summary.isFinal ? "여행 결산" : "여행 경비"}</h2>
        {canEdit ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBudgetOpen(true)}>
              <SettingsIcon data-icon="inline-start" aria-hidden />
              예산 설정
            </Button>
            <Button onClick={() => setExpenseDialog({ mode: "create" })}>
              <PlusIcon data-icon="inline-start" aria-hidden />
              지출 기록
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <BudgetMeter summary={summary} />
        <section aria-labelledby="insights-title" className="rounded-xl border bg-card p-6">
          <h2 id="insights-title" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            AI 지출 분석
          </h2>
          <ul className="mt-3 space-y-3">
            {summary.insights.map((i) => (
              <li key={i.text} className="flex gap-2.5 text-sm leading-relaxed">
                {i.tone === "warning" ? (
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-[oklch(0.6_0.14_65)]" aria-label="주의" />
                ) : i.tone === "good" ? (
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" aria-label="좋음" />
                ) : (
                  <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                )}
                {i.text}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {summary.spent > 0 ? (
        <div className="grid gap-10 lg:grid-cols-2">
          <CategoryBars summary={summary} />
          <DailyColumns summary={summary} />
        </div>
      ) : null}

      <section aria-labelledby="expenses-title" className="space-y-4">
        <h2 id="expenses-title" className="text-lg font-semibold">
          지출 내역 <span className="text-base font-normal text-muted-foreground">{expenses.length}건</span>
        </h2>
        {expenses.length === 0 ? (
          <EmptyState
            icon={WalletIcon}
            title="아직 기록된 지출이 없어요"
            description="쓴 돈을 기록하면 예산 사용률과 카테고리별 지출을 자동으로 분석해요."
            action={
              canEdit ? (
                <Button onClick={() => setExpenseDialog({ mode: "create" })}>
                  <PlusIcon data-icon="inline-start" aria-hidden />첫 지출 기록하기
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, list]) => (
              <div key={date}>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  {formatShortDate(date)}
                  {list[0]?.dayNumber ? ` · DAY ${list[0].dayNumber}` : ""}
                </h3>
                <ul className="divide-y rounded-lg border bg-card">
                  {list.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="rounded-lg bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                        {EXPENSE_CATEGORY_LABELS[e.category]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.title}</span>
                        {e.note ? <span className="block truncate text-xs text-muted-foreground">{e.note}</span> : null}
                      </span>
                      <span className="font-semibold tabular-nums">{formatMoney(e.amount, e.currency)}</span>
                      {canEdit ? (
                        <span className="flex">
                          <Button variant="ghost" size="icon-sm" aria-label={`${e.title} 수정`} onClick={() => setExpenseDialog({ mode: "edit", expense: e })}>
                            <PencilIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${e.title} 삭제`}
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(e.id)}
                          >
                            <Trash2Icon />
                          </Button>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {expenseDialog ? (
        <ExpenseDialog
          key={expenseDialog.mode === "edit" ? expenseDialog.expense.id : "new"}
          tripId={tripId}
          data={data}
          state={expenseDialog}
          onClose={() => setExpenseDialog(null)}
          onSaved={(next) => qc.setQueryData(key, next)}
        />
      ) : null}
      {budgetOpen ? (
        <BudgetDialog tripId={tripId} data={data} onClose={() => setBudgetOpen(false)} onSaved={(next) => qc.setQueryData(key, next)} />
      ) : null}
    </div>
  );
}

function ExpenseDialog({
  tripId,
  data,
  state,
  onClose,
  onSaved,
}: {
  tripId: string;
  data: BudgetData;
  state: NonNullable<ExpenseDialogState>;
  onClose: () => void;
  onSaved: (next: BudgetData) => void;
}) {
  const editing = state.mode === "edit" ? state.expense : null;
  const defaultDate =
    data.trip.today >= data.trip.startDate && data.trip.today <= data.trip.endDate ? data.trip.today : data.trip.startDate;
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing
        ? apiFetch<BudgetData>(`/api/trips/${tripId}/expenses/${editing.id}`, { method: "PATCH", body })
        : apiFetch<BudgetData>(`/api/trips/${tripId}/expenses`, { method: "POST", body }),
    onSuccess: (next) => {
      onSaved(next);
      toast.success(editing ? "지출을 수정했어요." : "지출을 기록했어요.");
      onClose();
    },
  });
  const fields = save.error instanceof ApiError ? save.error.fields ?? {} : {};

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "지출 수정" : "지출 기록"}</DialogTitle>
          <DialogDescription>금액은 여행 통화({data.summary.currency})로 기록돼요.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            save.mutate({
              title: fd.get("title"),
              category: fd.get("category"),
              amount: String(fd.get("amount") ?? "").replace(/[,\s]/g, ""),
              date: fd.get("date"),
              note: fd.get("note") || null,
            });
          }}
        >
          <FormMessage message={save.isError ? errorMessage(save.error) : undefined} />
          <Field label="금액" error={fields.amount}>
            {(p) => <Input {...p} name="amount" inputMode="decimal" defaultValue={editing?.amount ?? ""} placeholder="0" autoFocus required />}
          </Field>
          <Field label="내용" error={fields.title}>
            {(p) => <Input {...p} name="title" maxLength={80} defaultValue={editing?.title ?? ""} placeholder="예: 이치란 라멘" required />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="카테고리" error={fields.category}>
              {(p) => (
                <NativeSelect {...p} name="category" defaultValue={editing?.category ?? "FOOD"}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {EXPENSE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="날짜" error={fields.date}>
              {(p) => <Input {...p} type="date" name="date" defaultValue={editing?.date ?? defaultDate} required />}
            </Field>
          </div>
          <Field label="메모" optional error={fields.note}>
            {(p) => <Input {...p} name="note" maxLength={300} defaultValue={editing?.note ?? ""} />}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              취소
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetDialog({
  tripId,
  data,
  onClose,
  onSaved,
}: {
  tripId: string;
  data: BudgetData;
  onClose: () => void;
  onSaved: (next: BudgetData) => void;
}) {
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch<BudgetData>(`/api/trips/${tripId}/budget`, { method: "PUT", body }),
    onSuccess: (next) => {
      onSaved(next);
      toast.success("예산을 저장했어요.");
      onClose();
    },
  });
  const fields = save.error instanceof ApiError ? save.error.fields ?? {} : {};
  const { summary } = data;

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>예산 설정</DialogTitle>
          <DialogDescription>카테고리별 예산은 선택이에요. 정해 두면 초과 여부를 알려드려요.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const num = (k: string) => String(fd.get(k) ?? "").replace(/[,\s]/g, "");
            const allocations: Record<string, string> = {};
            for (const c of EXPENSE_CATEGORIES) if (num(`alloc_${c}`)) allocations[c] = num(`alloc_${c}`);
            save.mutate({ totalAmount: num("total") || "0", allocations });
          }}
        >
          <FormMessage message={save.isError ? errorMessage(save.error) : undefined} />
          <Field label={`총 예산 (${summary.currency})`} error={fields.totalAmount}>
            {(p) => <Input {...p} name="total" inputMode="decimal" defaultValue={summary.total ?? ""} required />}
          </Field>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">
              카테고리별 예산 <span className="font-normal text-muted-foreground">(선택)</span>
            </legend>
            <div className={cn("grid grid-cols-2 gap-3", fields.allocations && "rounded-lg ring-1 ring-destructive p-2")}>
              {EXPENSE_CATEGORIES.map((c) => (
                <label key={c} className="space-y-1 text-sm">
                  <span className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[c]}</span>
                  <Input name={`alloc_${c}`} inputMode="decimal" defaultValue={summary.allocations[c] ?? ""} />
                </label>
              ))}
            </div>
            {fields.allocations ? <p className="text-xs font-medium text-destructive">{fields.allocations}</p> : null}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              취소
            </Button>
            <Button type="submit" disabled={save.isPending}>
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
