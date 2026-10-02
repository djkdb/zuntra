"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/action-state";
import { fieldErrors, formDataToObject, formValues } from "@/lib/validation/common";
import { travelProfileSchema } from "@/lib/validation/profile";
import { requireUser } from "@/server/auth/session";
import { signOut } from "@/server/auth";
import { deleteAccount, saveTravelProfile } from "@/server/services/user-service";

function parseProfile(formData: FormData) {
  return travelProfileSchema.safeParse(formDataToObject(formData, ["styles"]));
}

export async function completeOnboardingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseProfile(formData);
  if (!parsed.success) {
    return { message: "입력값을 확인해 주세요.", fields: fieldErrors(parsed.error), values: formValues(formData) };
  }
  await saveTravelProfile(user.id, parsed.data);
  redirect("/dashboard?welcome=1");
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseProfile(formData);
  if (!parsed.success) {
    return { message: "입력값을 확인해 주세요.", fields: fieldErrors(parsed.error), values: formValues(formData) };
  }
  await saveTravelProfile(user.id, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true, message: "여행 프로필을 저장했어요.", values: formValues(formData) };
}

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const confirmation = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();
  if (confirmation !== user.email.toLowerCase()) {
    return { message: "이메일이 일치하지 않아요.", fields: { confirmEmail: "가입한 이메일을 정확히 입력해 주세요." } };
  }
  await deleteAccount(user.id);
  await signOut({ redirectTo: "/?account=deleted" });
  return { ok: true };
}
