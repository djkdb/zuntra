"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "@/app/(auth)/actions";
import { Field, FormMessage } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/action-state";

export function LoginForm({ callbackUrl, notice }: { callbackUrl?: string; notice?: string }) {
  const [state, action] = useActionState(signInAction, initialFormState);

  return (
    <form action={action} className="space-y-5" noValidate>
      {notice && !state.message ? <FormMessage tone="success" message={notice} /> : null}
      <FormMessage message={state.message} />
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <Field label="이메일" error={state.fields?.email}>
        {(props) => (
          <Input {...props} name="email" type="email" autoComplete="email" inputMode="email" required autoFocus defaultValue={state.values?.email} />
        )}
      </Field>
      <Field label="비밀번호" error={state.fields?.password}>
        {(props) => <Input {...props} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel="로그인 중…">
        로그인
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        아직 계정이 없나요?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}
