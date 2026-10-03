"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type FormState, safeRedirectPath } from "@/lib/action-state";
import { fieldErrors } from "@/lib/validation/common";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";
import { signIn, signOut } from "@/server/auth";
import { AppError } from "@/server/errors";
import { clientIpFrom, signupLimiter } from "@/server/rate-limit";
import { registerUser } from "@/server/services/user-service";

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { message: "입력값을 확인해 주세요.", fields: fieldErrors(parsed.error), values };

  const limit = await signupLimiter.consume(`ip:${clientIpFrom(await headers())}`);
  if (!limit.ok) return { message: "가입 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.", values };

  try {
    await registerUser(parsed.data);
  } catch (error) {
    if (error instanceof AppError) return { message: error.message, fields: error.fields, values };
    throw error;
  }

  try {
    // Throws a redirect on success, which must propagate.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/onboarding",
    });
  } catch (error) {
    // The account exists; if automatic sign-in is refused (e.g. rate limited), send them to log in.
    if (error instanceof AuthError) redirect("/login?registered=1");
    throw error;
  }
  return { ok: true };
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { message: "입력값을 확인해 주세요.", fields: fieldErrors(parsed.error), values };

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeRedirectPath(formData.get("callbackUrl"), "/dashboard"),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = "code" in error ? (error as { code?: string }).code : undefined;
      if (code === "rate_limited") {
        return { message: "로그인 시도가 너무 많아요. 15분 후 다시 시도해 주세요.", values };
      }
      return { message: "이메일 또는 비밀번호가 올바르지 않아요.", values };
    }
    throw error;
  }
  return { ok: true };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
