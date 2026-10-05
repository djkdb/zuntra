"use client";

import { PencilIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * The day's own title ("교토 · 후시미/나라 당일") shown next to DAY n, editable in place.
 * Enter saves, Escape cancels; an empty title clears it.
 */
export function DayTitleEditor({ title, editable, onSave }: { title: string | null; editable: boolean; onSave: (title: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? "");
  // Leaving the field with Enter/Escape unmounts it; put focus back on the edit button.
  const refocus = useRef(false);
  if (editing) {
    const commit = () => {
      setEditing(false);
      const next = draft.trim() || null;
      if (next !== title) onSave(next);
    };
    return (
      <Input
        autoFocus
        aria-label="이 날의 제목"
        value={draft}
        maxLength={40}
        placeholder="예: 구시가지 · 야시장"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") {
            // Focus moves to the edit button within this keydown; without this the same Enter
            // would "click" it and reopen the field.
            e.preventDefault();
            refocus.current = true;
          }
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(title ?? "");
            setEditing(false);
          }
        }}
        className="h-8 max-w-64 text-sm md:h-8"
      />
    );
  }
  if (!editable) return title ? <span className="text-muted-foreground">{title}</span> : null;
  return (
    <button
      type="button"
      ref={(el) => {
        if (el && refocus.current) {
          refocus.current = false;
          el.focus();
        }
      }}
      onClick={() => {
        setDraft(title ?? "");
        setEditing(true);
      }}
      className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={title ? `이 날의 제목 ‘${title}’ 바꾸기` : "이 날의 제목 붙이기"}
    >
      {title ?? "제목 붙이기"}
      <PencilIcon className="size-3" aria-hidden />
    </button>
  );
}
