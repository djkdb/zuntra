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
  .min(8, "비밀번호는 8자 이상이어야 해요.")
  .max(72, "비밀번호는 72자 이하여야 해요.") // bcrypt only uses the first 72 bytes
  .regex(/[A-Za-z]/, "영문자를 하나 이상 포함해 주세요.")
  .regex(/[0-9]/, "숫자를 하나 이상 포함해 주세요.");

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
