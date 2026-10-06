"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { signUpAction } from "@/app/(auth)/actions";
import { Field, FormMessage, useFocusFirstError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/action-state";

export function SignupForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, action] = useActionState(signUpAction, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(formRef, state);

  return (
    <form ref={formRef} action={action} className="space-y-5" noValidate>
      <FormMessage message={state.message} />
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <Field label="이름" error={state.fields?.name}>
        {(props) => <Input {...props} name="name" autoComplete="name" required maxLength={40} autoFocus defaultValue={state.values?.name} />}
      </Field>
      <Field label="이메일" error={state.fields?.email}>
        {(props) => <Input {...props} name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} />}
      </Field>
      <Field label="비밀번호" error={state.fields?.password} hint="8자 이상, 영문과 숫자를 포함해 주세요.">
        {(props) => (
          <Input {...props} name="password" type="password" autoComplete="new-password" required minLength={8} />
        )}
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel="계정 만드는 중…">
        시작하기
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        이미 계정이 있나요?{" "}
        <Link href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"} className="font-medium text-primary underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
