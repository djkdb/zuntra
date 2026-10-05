import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageHeader } from "@/components/layout/page-header";
import { DeleteAccount } from "@/components/profile/delete-account";
import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { ThemeSelect } from "@/components/profile/theme-select";
import { requireOnboardedUser } from "@/server/auth/session";
import { getTravelProfile } from "@/server/services/user-service";

export const metadata: Metadata = { title: "설정" };

export default async function SettingsPage() {
  const user = await requireOnboardedUser();
  const profile = await getTravelProfile(user.id);

  return (
    <div className="max-w-3xl space-y-10">
      <PageHeader title="설정" description={user.email} />

      <section aria-labelledby="profile-title" className="space-y-6">
        <div>
          <h2 id="profile-title" className="text-lg font-semibold">
            여행 프로필
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">AI 일정과 추천의 기준이 돼요.</p>
        </div>
        <ProfileSettingsForm
          defaults={{
            name: user.name,
            styles: profile?.styles,
            pace: profile?.pace,
            budgetLevel: profile?.budgetLevel,
            favoriteFoods: profile?.favoriteFoods,
            companionType: profile?.companionType,
          }}
        />
      </section>

      <section aria-labelledby="display-title" className="space-y-4 border-t pt-10">
        <h2 id="display-title" className="text-lg font-semibold">
          화면
        </h2>
        <ThemeSelect />
      </section>

      <section aria-labelledby="account-title" className="space-y-4 border-t pt-10">
        <h2 id="account-title" className="text-lg font-semibold">
          계정
        </h2>
        <div className="flex flex-wrap gap-3">
          <SignOutButton />
          {user.role === "ADMIN" ? (
            <Link href="/admin" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-primary hover:bg-muted">
              관리자 대시보드
            </Link>
          ) : null}
          <DeleteAccount email={user.email} />
        </div>
      </section>
    </div>
  );
}
