"use client";

import { useActionState, useState } from "react";
import { deleteAccountAction } from "@/app/profile-actions";
import { Field, FormMessage } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/action-state";

export function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteAccountAction, initialFormState);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">계정 삭제</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={action} className="space-y-5">
          <AlertDialogHeader>
            <AlertDialogTitle>계정을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              모든 여행, 일정, 경비, 기록이 영구적으로 삭제돼요. 계속하려면 가입한 이메일(
              <strong className="font-medium text-foreground">{email}</strong>)을 입력해 주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormMessage message={state.message} />
          <Field label="이메일 확인" error={state.fields?.confirmEmail}>
            {(props) => <Input {...props} name="confirmEmail" type="email" autoComplete="off" required />}
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">취소</AlertDialogCancel>
            <SubmitButton variant="destructive" pendingLabel="삭제 중…">
              영구 삭제
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
