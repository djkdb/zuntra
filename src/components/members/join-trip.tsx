"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Accepts an invite. If the trip already tracks costs under names (e.g. "민수"), the joiner can
 * say which one they are so past expenses stay theirs.
 */
export function JoinTrip({ token, unclaimed }: { token: string; unclaimed: { id: string; name: string }[] }) {
  const router = useRouter();
  const [participantId, setParticipantId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // This page sits outside the app shell (no query client), so a plain request is enough.
  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const { tripId } = await apiFetch<{ tripId: string }>(`/api/invites/${token}/accept`, {
        method: "POST",
        body: participantId ? { participantId } : {},
      });
      router.push(`/trips/${tripId}?joined=1`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      {unclaimed.length > 0 ? (
        <fieldset>
          <legend className="text-sm font-medium">경비 정산에 이미 등록된 이름이 있어요. 본인이 있나요?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[{ id: "", name: "없어요, 새로 추가" }, ...unclaimed].map((p) => (
              <label
                key={p.id || "new"}
                className={cn(
                  "cursor-pointer rounded-full border px-3.5 py-2 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  participantId === p.id ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name="participant"
                  value={p.id}
                  checked={participantId === p.id}
                  onChange={() => setParticipantId(p.id)}
                  className="sr-only"
                />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <FormMessage message={error ?? undefined} />
      <Button size="lg" className="w-full" onClick={accept} disabled={busy}>
        {busy ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
        여행에 참여하기
      </Button>
    </div>
  );
}
