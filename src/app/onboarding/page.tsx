import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { OnboardingForm } from "@/components/profile/onboarding-form";
import { requireUser } from "@/server/auth/session";
import { getTravelProfile } from "@/server/services/user-service";

export const metadata: Metadata = { title: "여행 프로필 만들기", robots: { index: false } };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardedAt) redirect("/dashboard");
  const profile = await getTravelProfile(user.id);

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-14">
      <Logo />
      <p className="mt-10 text-sm font-medium text-primary">여행 프로필</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">어떤 여행자인지 알려주세요</h1>
      <p className="mt-3 mb-10 text-muted-foreground">
        AI가 일정을 만들고 여행 중 제안을 할 때 이 정보를 기준으로 삼아요. 언제든 설정에서 바꿀 수 있어요.
      </p>
      <OnboardingForm
        defaults={{
          name: user.name,
          styles: profile?.styles,
          pace: profile?.pace,
          budgetLevel: profile?.budgetLevel,
          favoriteFoods: profile?.favoriteFoods,
          companionType: profile?.companionType,
        }}
      />
    </main>
  );
}
