import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "이메일을 입력해 주세요.")
  .max(254)
  .email("올바른 이메일 주소를 입력해 주세요.");

export const passwordSchema = z
  .string()
  .max(72, "비밀번호는 72자 이하여야 해요.") // bcrypt only uses the first 72 bytes
  // One message for every rule, so a short password already tells the whole requirement.
  .refine((v) => v.length >= 8 && /[A-Za-z]/.test(v) && /[0-9]/.test(v), "8자 이상, 영문과 숫자를 섞어 주세요.");

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(40, "이름은 40자 이내로 입력해 주세요."),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "비밀번호를 입력해 주세요.").max(72),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
