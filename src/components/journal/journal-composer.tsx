"use client";

import { ImagePlusIcon, Loader2Icon, StarIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch, errorMessage } from "@/lib/api-client";
import { formatShortDate } from "@/lib/dates";
import { MAX_PHOTOS_PER_ENTRY, MAX_PHOTO_BYTES, MOOD_OPTIONS, type PhotoView } from "@/lib/journal";
import { resizeImage } from "@/lib/image-resize";
import { cn } from "@/lib/utils";
import type { JournalData } from "@/server/services/journal-service";
import { MoodIcon } from "@/components/journal/mood-icon";

async function uploadOne(tripId: string, file: File): Promise<PhotoView> {
  const { blob, width, height } = await resizeImage(file);
  if (blob.size > MAX_PHOTO_BYTES) throw new ApiError("VALIDATION", "사진은 8MB 이하만 올릴 수 있어요.", 400);
  const form = new FormData();
  form.append("file", blob, "photo");
  if (width) form.append("width", String(width));
  if (height) form.append("height", String(height));
  let res: Response;
  try {
    res = await fetch(`/api/trips/${tripId}/photos`, { method: "POST", body: form, credentials: "same-origin" });
  } catch {
    throw new ApiError("NETWORK", "네트워크에 연결할 수 없어요.", 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.error?.code ?? "INTERNAL", body?.error?.message ?? "사진을 올리지 못했어요.", res.status);
  return body.data as PhotoView;
}

export function JournalComposer({
  tripId,
  data,
  defaultDate,
  onSaved,
}: {
  tripId: string;
  data: JournalData;
  defaultDate: string;
  onSaved: (next: JournalData) => void;
}) {
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [itemId, setItemId] = useState("");
  const [photos, setPhotos] = useState<PhotoView[]>([]);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const day = data.days.find((d) => d.date === date);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, MAX_PHOTOS_PER_ENTRY - photos.length);
    setError(undefined);
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const photo = await uploadOne(tripId, file);
        setPhotos((p) => [...p, photo]);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const save = async () => {
    if (!content.trim()) {
      setError("기록할 내용을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const next = await apiFetch<JournalData>(`/api/trips/${tripId}/journal`, {
        method: "POST",
        body: { content, mood, rating, date, itemId: itemId || null, photoIds: photos.map((p) => p.id) },
      });
      onSaved(next);
      setContent("");
      setMood(null);
      setRating(null);
      setItemId("");
      setPhotos([]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="composer-title" className="space-y-4 rounded-xl border bg-card p-5">
      <h2 id="composer-title" className="font-semibold">
        오늘의 기억 남기기
      </h2>
      <FormMessage message={error} />
      <label htmlFor="journal-content" className="sr-only">
        기록 내용
      </label>
      <Textarea
        id="journal-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="오늘 가장 기억에 남는 순간을 적어 보세요."
      />

      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="기분">
        {MOOD_OPTIONS.map((m, index) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mood === m.value}
            tabIndex={rovingTabIndex(MOOD_OPTIONS.map((o) => o.value), mood, index)}
            onKeyDown={(e) => rovingKeyDown(e, MOOD_OPTIONS.map((o) => o.value), mood ?? MOOD_OPTIONS[0]!.value, setMood)}
            onClick={() => setMood(mood === m.value ? null : m.value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm",
              mood === m.value ? "border-primary bg-secondary font-medium" : "hover:bg-muted",
            )}
          >
            <MoodIcon mood={m.value} />
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1" role="radiogroup" aria-label="별점">
        {RATINGS.map((n, index) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}점`}
            tabIndex={rovingTabIndex(RATINGS, rating, index)}
            onKeyDown={(e) => rovingKeyDown(e, RATINGS, rating ?? 1, setRating)}
            onClick={() => setRating(rating === n ? null : n)}
            className="p-1"
          >
            <StarIcon className={cn("size-6", rating !== null && n <= rating ? "fill-sunset text-sunset" : "text-muted-foreground")} />
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="journal-date" className="mb-1 block text-sm font-medium">
            날짜
          </label>
          <NativeSelect
            id="journal-date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setItemId("");
            }}
          >
            {data.days.map((d) => (
              <option key={d.id} value={d.date}>
                DAY {d.dayNumber} · {formatShortDate(d.date)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="journal-place" className="mb-1 block text-sm font-medium">
            장소 <span className="font-normal text-muted-foreground">(선택)</span>
          </label>
          <NativeSelect id="journal-place" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">선택 안 함</option>
            {day?.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {photos.length > 0 || uploading > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              <Image src={p.url} alt="" width={80} height={80} unoptimized className="size-20 rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((list) => list.filter((x) => x.id !== p.id))}
                aria-label="사진 빼기"
                className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-foreground text-background"
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <li key={`u${i}`} className="flex size-20 items-center justify-center rounded-xl bg-muted" role="status">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-label="사진 올리는 중" />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="sr-only"
          id="journal-photos"
          onChange={(e) => addFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInput.current?.click()}
          disabled={photos.length >= MAX_PHOTOS_PER_ENTRY || uploading > 0}
        >
          <ImagePlusIcon data-icon="inline-start" aria-hidden />
          사진 {photos.length > 0 ? `${photos.length}/${MAX_PHOTOS_PER_ENTRY}` : "추가"}
        </Button>
        <Button onClick={save} disabled={saving || uploading > 0}>
          {saving ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
          기록하기
        </Button>
      </div>
    </section>
  );
}

const RATINGS = [1, 2, 3, 4, 5];

/** ARIA radio group: one tab stop (the checked option, else the first). */
function rovingTabIndex<T>(values: T[], current: T | null, index: number) {
  return (current === null ? index === 0 : values[index] === current) ? 0 : -1;
}

/** Arrow keys move the selection (and focus) within the group. */
function rovingKeyDown<T>(e: React.KeyboardEvent<HTMLButtonElement>, values: T[], current: T, select: (v: T) => void) {
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const next = (values.indexOf(current) + step + values.length) % values.length;
  select(values[next]!);
  const buttons = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
  buttons?.[next]?.focus();
}
