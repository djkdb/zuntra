"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTripAction } from "@/app/(app)/trips/actions";
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

export function DeleteTripButton({ tripId, title }: { tripId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const onConfirm = () =>
    startTransition(async () => {
      const result = await deleteTripAction(tripId);
      // On success the action redirects; we only get here on failure.
      if (result?.message) {
        toast.error(result.message);
        setOpen(false);
      }
    });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          <Trash2Icon data-icon="inline-start" aria-hidden />
          삭제
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>‘{title}’을(를) 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            일정, 경비, 준비물, 여행 기록이 모두 함께 삭제되며 되돌릴 수 없어요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
            삭제하기
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
