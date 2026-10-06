import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { JoinTrip } from "@/components/members/join-trip";
import { Button } from "@/components/ui/button";
import { formatDateRange } from "@/lib/dates";
import { getCurrentUser } from "@/server/auth/session";
import { getInvitePreview } from "@/server/services/member-service";

export const metadata: Metadata = { title: "여행 초대", robots: { index: false } };

export default async function JoinPage(props: PageProps<"/join/[token]">) {
  const { token } = await props.params;
  const here = `/join/${token}`;
  // Signed-out visitors see the invite first; signing up or in brings them back here.
  const user = await getCurrentUser();
  if (user && !user.onboardedAt) redirect(`/onboarding?next=${encodeURIComponent(here)}`);
  const preview = await getInvitePreview(token, user?.id ?? null);
  if (preview.state === "ok" && preview.alreadyMember) redirect(`/trips/${preview.tripId}`);
  const back = encodeURIComponent(here);

  return (
    <main id="main" className="mx-auto w-full max-w-lg px-5 py-8 sm:py-14">
      <Logo />
      {preview.state === "ok" ? (
        <section className="mt-10">
          <p className="text-sm font-medium text-primary">{preview.trip.ownerName}님의 초대</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{preview.trip.title}</h1>
          <p className="mt-2 text-muted-foreground">
            {preview.trip.destination} · {formatDateRange(preview.trip.startDate, preview.trip.endDate)}
          </p>
          <p className="mt-6 rounded-lg border bg-card px-4 py-3 text-sm">
            {preview.role === "EDITOR"
              ? "참여하면 일정·경비·준비물을 함께 고치고 기록할 수 있어요."
              : "참여하면 일정과 경비를 볼 수 있어요. 고치는 건 여행을 만든 사람이 권한을 바꿔 줘야 해요."}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            지금 {preview.memberCount}명이 함께하고 있어요 · {new Date(preview.expiresAt).getMonth() + 1}월 {new Date(preview.expiresAt).getDate()}일까지 쓸 수 있는 링크예요.
          </p>
          {user ? (
            <JoinTrip token={token} unclaimed={preview.unclaimed} myName={user.name} />
          ) : (
            <div className="mt-6 space-y-3">
              <Button asChild size="lg" className="w-full">
                <Link href={`/signup?callbackUrl=${back}`}>처음이에요 · 가입하고 참여하기</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link href={`/login?callbackUrl=${back}`}>이미 계정이 있어요 · 로그인</Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">가입은 1분이면 끝나고, 끝나면 이 여행으로 바로 들어가요.</p>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-10">
          <h1 className="text-2xl font-bold">{preview.state === "expired" ? "만료된 초대 링크예요" : "초대 링크를 찾을 수 없어요"}</h1>
          <p className="mt-2 text-muted-foreground">
            {preview.state === "expired"
              ? "링크가 만료되었거나 여행을 만든 사람이 취소했어요. 새 링크를 받아 주세요."
              : "주소가 정확한지 확인해 주세요. 링크 전체를 복사했는지도 확인해 보세요."}
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/dashboard">대시보드로</Link>
          </Button>
        </section>
      )}
    </main>
  );
}
