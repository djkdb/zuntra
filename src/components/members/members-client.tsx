"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, CopyIcon, LinkIcon, Loader2Icon, LogOutIcon, PencilIcon, PlusIcon, Share2Icon, Trash2Icon, UserMinusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useSeededQuery } from "@/components/use-seeded-query";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { focusAfterRemoval } from "@/lib/focus";
import { cn } from "@/lib/utils";
import type { MembersData } from "@/server/services/member-service";

const ROLE_LABEL = { OWNER: "만든 사람", EDITOR: "편집 가능", VIEWER: "보기 전용" } as const;
const INVITE_ROLES = [
  { role: "EDITOR", title: "같이 편집하는 링크", hint: "일정·경비·준비물을 같이 고쳐요. 일행에게 보내세요." },
  { role: "VIEWER", title: "보기만 하는 링크", hint: "가족처럼 일정만 확인하면 되는 사람에게 보내세요." },
] as const;

/** After a re-render swaps controls (link made/revoked, edit field closed), focus the new one. */
const focusById = (id: string) => requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(id)?.focus()));

const expiryLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일까지`;
};

export function MembersClient({ tripId, initialData, travelerCount }: { tripId: string; initialData: MembersData; travelerCount: number }) {
  const qc = useQueryClient();
  const router = useRouter();
  const key = ["members", tripId] as const;
  const { data = initialData } = useSeededQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiFetch<MembersData>(`/api/trips/${tripId}/members`, { signal }),
    initialData,
    // Others join and leave from their own devices; check on every visit.
    staleTime: 0,
  });
  const isOwner = data.myRole === "OWNER";
  const canEdit = data.myRole !== "VIEWER";
  const set = (next: MembersData) => qc.setQueryData(key, next);
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const invite = useMutation({
    mutationFn: (role: "EDITOR" | "VIEWER") => apiFetch<MembersData>(`/api/trips/${tripId}/invites`, { method: "POST", body: { role } }),
    onSuccess: set,
    onError,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch<MembersData>(`/api/trips/${tripId}/invites/${id}`, { method: "DELETE" }),
    onSuccess: (next) => {
      set(next);
      toast("링크를 취소했어요. 이미 보낸 링크로는 더 이상 참여할 수 없어요.");
    },
    onError,
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch<MembersData>(`/api/trips/${tripId}/members/${userId}`, { method: "PATCH", body: { role } }),
    onSuccess: (next) => {
      set(next);
      toast.success("권한을 바꿨어요.");
    },
    onError,
  });
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string; me: boolean } | null>(null);
  const remove = useMutation({
    mutationFn: (userId: string) => apiFetch<MembersData | null>(`/api/trips/${tripId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: (next, userId) => {
      if (!next) {
        toast("여행에서 나왔어요.");
        router.push("/trips");
        router.refresh();
        return;
      }
      set(next);
      toast(`${data.members.find((m) => m.userId === userId)?.name ?? "멤버"}님을 내보냈어요.`);
    },
    onError,
  });

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0 space-y-8">
        {isOwner ? (
        <section aria-labelledby="invite-title" className="space-y-3">
          <div>
            <h2 id="invite-title" className="text-base font-semibold">
              초대 링크
            </h2>
            <p className="text-sm text-muted-foreground">
              링크를 카톡으로 보내면, 받은 사람이 가입하거나 로그인하자마자 이 여행에 들어와요. 링크는 14일 동안 쓸 수 있어요.
            </p>
          </div>
          {isOwner ? (
            <ul className="divide-y rounded-lg border bg-card">
              {INVITE_ROLES.map(({ role, title, hint }) => {
                const live = data.invites.find((i) => i.role === role);
                return (
                  <li key={role} className="space-y-2.5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-xs text-muted-foreground">{live ? `${hint} · ${expiryLabel(live.expiresAt)}` : hint}</p>
                      </div>
                      {!live ? (
                        <Button
                          id={`make-${role}`}
                          size="sm"
                          variant="outline"
                          onClick={() => invite.mutate(role, { onSuccess: () => focusById(`copy-${role}`) })}
                          disabled={invite.isPending}
                        >
                          <LinkIcon data-icon="inline-start" aria-hidden />
                          링크 만들기
                        </Button>
                      ) : null}
                    </div>
                    {live ? (
                      <InviteLink
                        path={`/join/${live.token}`}
                        copyId={`copy-${role}`}
                        onRenew={() => invite.mutate(role, { onSuccess: () => focusById(`copy-${role}`) })}
                        onRevoke={() => revoke.mutate(live.id, { onSuccess: () => focusById(`make-${role}`) })}
                        busy={invite.isPending || revoke.isPending}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
        ) : null}

        <section aria-labelledby="members-title" className="space-y-3">
          <h2 id="members-title" className="text-base font-semibold">
            앱으로 함께하는 사람 <span className="font-normal text-muted-foreground">{data.members.length}명</span>
          </h2>
          <ul className="divide-y rounded-lg border bg-card">
            {data.members.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
                >
                  {m.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {m.name}
                    {m.isMe ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">나</span> : null}
                  </span>
                  {m.email || m.accountName !== m.name ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {[m.accountName !== m.name ? `계정 이름 ${m.accountName}` : null, m.email].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </span>
                {isOwner && m.role !== "OWNER" ? (
                  <div className="flex items-center gap-1.5">
                    <NativeSelect
                      aria-label={`${m.name} 권한`}
                      value={m.role}
                      onChange={(e) => changeRole.mutate({ userId: m.userId, role: e.target.value })}
                      // Not disabled while saving: that would throw keyboard focus out of the select.
                      aria-busy={changeRole.isPending}
                      className="h-9 w-32 md:h-8"
                    >
                      <option value="EDITOR">{ROLE_LABEL.EDITOR}</option>
                      <option value="VIEWER">{ROLE_LABEL.VIEWER}</option>
                    </NativeSelect>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="max-sm:size-10"
                      aria-label={`${m.name} 여행에서 빼기`}
                      onClick={() => setConfirmRemove({ userId: m.userId, name: m.name, me: false })}
                    >
                      <UserMinusIcon />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">{ROLE_LABEL[m.role]}</span>
                )}
                {m.isMe && m.role !== "OWNER" ? (
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirmRemove({ userId: m.userId, name: m.name, me: true })}>
                    <LogOutIcon data-icon="inline-start" aria-hidden />
                    나가기
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Participants tripId={tripId} data={data} canEdit={canEdit} travelerCount={travelerCount} onSaved={set} />

      <AlertDialog open={confirmRemove !== null} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmRemove?.me ? "이 여행에서 나갈까요?" : `${confirmRemove?.name}님을 여행에서 뺄까요?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove?.me
                ? "다시 들어오려면 새 초대 링크가 필요해요. 내가 낸 경비 기록은 정산에 그대로 남아요."
                : "더 이상 이 여행을 볼 수 없어요. 그동안 낸 경비 기록은 이름으로 정산에 남아요."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmRemove) remove.mutate(confirmRemove.userId);
                setConfirmRemove(null);
              }}
            >
              {confirmRemove?.me ? "나가기" : "빼기"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const noSubscribe = () => () => {};

function InviteLink({ path, copyId, onRenew, onRevoke, busy }: { path: string; copyId: string; onRenew: () => void; onRevoke: () => void; busy: boolean }) {
  const [copied, setCopied] = useState(false);
  // Browser-only values, read so that hydration still matches the server's render.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);
  const url = `${origin}${path}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("링크를 복사했어요. 메신저에 붙여 넣어 보내세요.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사하지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.");
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input readOnly value={url} aria-label="초대 링크" onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs md:text-xs" />
        <Button id={copyId} variant="outline" onClick={copy} className="shrink-0">
          {copied ? <CheckIcon data-icon="inline-start" aria-hidden /> : <CopyIcon data-icon="inline-start" aria-hidden />}
          {copied ? "복사됨" : "복사"}
        </Button>
        {canShare ? (
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="공유하기"
            onClick={() => navigator.share({ title: "여행에 초대해요", url }).catch(() => {})}
          >
            <Share2Icon />
          </Button>
        ) : null}
      </div>
      <div className="flex gap-3 text-xs">
        <button type="button" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={onRenew} disabled={busy}>
          새 링크로 바꾸기
        </button>
        <button type="button" className="text-muted-foreground underline-offset-4 hover:text-destructive hover:underline" onClick={onRevoke} disabled={busy}>
          링크 취소
        </button>
      </div>
    </div>
  );
}

function Participants({
  tripId,
  data,
  canEdit,
  travelerCount,
  onSaved,
}: {
  tripId: string;
  data: MembersData;
  canEdit: boolean;
  travelerCount: number;
  onSaved: (next: MembersData) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  // The participants endpoints return just the list; fold it into the members data.
  const save = (participants: MembersData["participants"]) => {
    onSaved({ ...data, participants });
    void qc.invalidateQueries({ queryKey: ["budget", tripId] });
  };
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const add = useMutation({
    mutationFn: (n: string) => apiFetch<MembersData["participants"]>(`/api/trips/${tripId}/participants`, { method: "POST", body: { name: n } }),
    onSuccess: (next) => {
      save(next);
      setName("");
    },
    onError,
  });
  const rename = useMutation({
    mutationFn: ({ id, name: n }: { id: string; name: string }) =>
      apiFetch<MembersData["participants"]>(`/api/trips/${tripId}/participants/${id}`, { method: "PATCH", body: { name: n } }),
    onSuccess: (next, { id }) => {
      save(next);
      setEditing(null);
      focusById(`rename-${id}`);
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<MembersData["participants"]>(`/api/trips/${tripId}/participants/${id}`, { method: "DELETE" }),
    onSuccess: save,
    onError,
  });
  const missing = Math.max(0, travelerCount - data.participants.length);

  return (
    <section aria-labelledby="participants-title" className="space-y-3">
      <div>
        <h2 id="participants-title" className="text-base font-semibold">
          경비 나눌 사람
        </h2>
        <p className="text-sm text-muted-foreground">앱을 쓰지 않는 일행도 이름만 넣으면 N빵 정산에 들어가요.</p>
      </div>
      {missing > 0 ? (
        <p className="rounded-lg bg-sunset/10 px-3 py-2 text-sm">
          여행 인원은 {travelerCount}명인데 {data.participants.length}명만 있어요. {missing}명을 더 넣어 보세요.
        </p>
      ) : null}
      <ul className="divide-y rounded-lg border bg-card">
        {data.participants.map((p) => (
          <li key={p.id} className="flex min-h-12 items-center gap-2 px-4 py-2">
            {editing?.id === p.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  rename.mutate(editing);
                }}
              >
                <Input
                  autoFocus
                  aria-label="이름"
                  value={editing.name}
                  maxLength={20}
                  onChange={(e) => setEditing({ id: p.id, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key !== "Escape") return;
                    setEditing(null);
                    focusById(`rename-${p.id}`);
                  }}
                  className="h-9 md:h-8"
                />
                <Button type="submit" size="sm" disabled={rename.isPending}>
                  저장
                </Button>
              </form>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p.name}
                  {p.left ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">나감 · 지난 경비만 정산</span>
                  ) : p.userId ? (
                    <span className="ml-1.5 text-xs text-muted-foreground">TripMate 사용 중</span>
                  ) : null}
                </span>
                {canEdit ? (
                  <>
                    <Button id={`rename-${p.id}`} variant="ghost" size="icon-sm" className="max-sm:size-10" aria-label={`${p.name} 이름 바꾸기`} onClick={() => setEditing({ id: p.id, name: p.name })}>
                      <PencilIcon />
                    </Button>
                    {!p.userId ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={cn("max-sm:size-10", p.inUse && "opacity-50")}
                        aria-label={`${p.name} 빼기`}
                        title={p.inUse ? "이 사람이 들어간 지출이 있어요" : undefined}
                        disabled={remove.isPending}
                        onClick={(e) => {
                          const restoreFocus = focusAfterRemoval(e.currentTarget.closest("li"));
                          const button = e.currentTarget;
                          remove.mutate(p.id, { onSuccess: restoreFocus, onError: () => requestAnimationFrame(() => button.focus()) });
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) add.mutate(name.trim());
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="이름 (예: 민수)" aria-label="추가할 사람 이름" />
          <Button type="submit" variant="outline" className="shrink-0" disabled={add.isPending || !name.trim()}>
            {add.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : <PlusIcon data-icon="inline-start" aria-hidden />}
            추가
          </Button>
        </form>
      ) : null}
    </section>
  );
}
