import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { safeRedirectPath } from "@/lib/action-state";

export const metadata: Metadata = { title: "회원가입" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const callbackUrl = safeRedirectPath((await props.searchParams).callbackUrl, "");
  return (
    <>
      <h1 className="text-3xl font-bold">{callbackUrl.startsWith("/join/") ? "가입하고 여행에 참여해요" : "TripMate 시작하기"}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        {callbackUrl.startsWith("/join/") ? "1분이면 끝나요. 가입하면 초대받은 여행으로 바로 돌아가요." : "1분이면 충분해요. 다음 여행을 함께 준비해요."}
      </p>
      <SignupForm callbackUrl={callbackUrl || undefined} />
    </>
  );
}
