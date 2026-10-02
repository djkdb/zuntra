import { LogOutIcon } from "lucide-react";
import type { Metadata } from "next";
import { signOutAction } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/layout/page-header";
import { DeleteAccount } from "@/components/profile/delete-account";
import { ProfileSettingsForm } from "@/components/profile/profile-settings-form";
import { ThemeSelect } from "@/components/profile/theme-select";
import { Button } from "@/components/ui/button";
import { requireOnboardedUser } from "@/server/auth/session";
import { getTravelProfile } from "@/server/services/user-service";

export const metadata: Metadata = { title: "설정" };

export default async function SettingsPage() {
  const user = await requireOnboardedUser();
  const profile = await getTravelProfile(user.id);

  return (
    <div className="max-w-2xl space-y-12">
      <PageHeader title="설정" description={user.email} />

      <section aria-labelledby="profile-title" className="space-y-6">
        <div>
          <h2 id="profile-title" className="text-xl font-semibold">
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
        <h2 id="display-title" className="text-xl font-semibold">
          화면
        </h2>
        <ThemeSelect />
      </section>

      <section aria-labelledby="account-title" className="space-y-4 border-t pt-10">
        <h2 id="account-title" className="text-xl font-semibold">
          계정
        </h2>
        <div className="flex flex-wrap gap-3">
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              <LogOutIcon data-icon="inline-start" aria-hidden />
              로그아웃
            </Button>
          </form>
          <DeleteAccount email={user.email} />
        </div>
      </section>
    </div>
  );
}
