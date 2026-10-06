"use client";

import { Loader2Icon, MapPinIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The city the traveller is based in that day ("오사카 → 교토 → 나라"). Weather, map distances
 * and AI suggestions use it; without one the trip destination applies.
 */
export function DayCityEditor({
  city,
  destination,
  editable,
  isLastDay,
  onSave,
}: {
  city: string | null;
  destination: string;
  editable: boolean;
  isLastDay: boolean;
  onSave: (city: string | null, applyToFollowing: boolean) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(city ?? destination);
  // Off by default: overwriting later days should be a deliberate choice.
  const [following, setFollowing] = useState(false);
  const [pending, setPending] = useState(false);
  const label = city ?? destination;

  if (!editable) return city ? <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><MapPinIcon className="size-3.5" aria-hidden />{city}</span> : null;

  const save = async (value: string | null) => {
    setPending(true);
    try {
      await onSave(value, following && !isLastDay);
      setOpen(false);
    } catch {
      // the mutation reports the error
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(city ?? destination);
          setOpen(true);
        }}
        className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`이 날 머무는 곳: ${label}. 바꾸기`}
      >
        <MapPinIcon className="size-3.5" aria-hidden />
        {label}
      </button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>이 날 머무는 곳</DialogTitle>
            <DialogDescription>여러 도시를 도는 여행이면 날마다 도시를 정해 주세요. 날씨와 AI 추천이 그 도시 기준으로 바뀌어요.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const value = draft.trim();
              // Typing the destination itself means "no separate city".
              void save(value && (city || value !== destination) ? value : null);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="day-city">도시</Label>
              <Input id="day-city" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} placeholder={`예: ${destination === "교토" ? "오사카" : "교토"}`} autoFocus />
            </div>
            {!isLastDay ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={following} onChange={(e) => setFollowing(e.target.checked)} className="size-4 accent-primary" />
                이후 날짜에도 똑같이 적용
              </label>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-between">
              {city ? (
                <Button type="button" variant="ghost" onClick={() => void save(null)} disabled={pending}>
                  {destination} 기준으로 되돌리기
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
                저장
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
