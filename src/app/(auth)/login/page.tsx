import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirectPath } from "@/lib/action-state";

export const metadata: Metadata = { title: "로그인", robots: { index: false } };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const callbackUrl = safeRedirectPath(searchParams.callbackUrl, "/dashboard");
  const notice =
    searchParams.reason === "session"
      ? "세션이 만료되었어요. 다시 로그인해 주세요."
      : searchParams.registered
        ? "가입이 완료되었어요. 로그인해 주세요."
        : searchParams.account === "deleted"
          ? "계정이 삭제되었어요."
          : undefined;

  return (
    <>
      <h1 className="text-3xl font-bold">다시 만나서 반가워요</h1>
      <p className="mt-2 mb-8 text-muted-foreground">로그인하고 여행을 이어가세요.</p>
      <LoginForm callbackUrl={callbackUrl} notice={notice} />
    </>
  );
}
