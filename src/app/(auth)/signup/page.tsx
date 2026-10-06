import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { safeRedirectPath } from "@/lib/action-state";

export const metadata: Metadata = { title: "회원가입" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const callbackUrl = safeRedirectPath((await props.searchParams).callbackUrl, "");
  return (
    <>
      <h1 className="text-3xl font-bold">TripMate 시작하기</h1>
      <p className="mt-2 mb-8 text-muted-foreground">1분이면 충분해요. 다음 여행을 함께 준비해요.</p>
      <SignupForm callbackUrl={callbackUrl || undefined} />
    </>
  );
}
