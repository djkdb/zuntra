import { z } from "zod";

// Default validation messages (enum, type, size…) in Korean; field-specific messages still win.
z.config(z.locales.ko());
import { isValidIsoDate } from "@/lib/dates";
import { parseAmountText } from "@/lib/format";

/** Trims, and turns empty strings into undefined so optional fields stay optional. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max}자 이내로 입력해 주세요.`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const isoDate = z
  .string()
  .trim()
  .refine(isValidIsoDate, "올바른 날짜를 입력해 주세요.");

/**
 * A list of short tags. Accepts an array or a comma/newline separated string
 * (what a plain text input submits), de-duplicates and caps the size.
 */
export const tagList = (maxItems: number, maxLength = 40) =>
  z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((value) => {
      const raw = Array.isArray(value) ? value : (value ?? "").split(/[,\n]/);
      const cleaned = raw.map((s) => s.trim()).filter(Boolean);
      return Array.from(new Set(cleaned));
    })
    .pipe(
      z
        .array(z.string().max(maxLength, `각 항목은 ${maxLength}자 이내로 입력해 주세요.`))
        .max(maxItems, `최대 ${maxItems}개까지 입력할 수 있어요.`),
    );

/** Flattens Zod issues into { field: firstMessage } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Converts FormData into a plain object; repeated keys become arrays. */
export function formDataToObject(formData: FormData, arrayKeys: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = arrayKeys.includes(key) ? values : values[0];
  }
  for (const key of arrayKeys) if (!(key in out)) out[key] = [];
  return out;
}

/** FormData → string / string[] map for echoing back into a form (drops file inputs). */
export function formValues(formData: FormData, omit: string[] = []): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION") || omit.includes(key)) continue;
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = values.length > 1 ? values : (values[0] ?? "");
  }
  return out;
}

/**
 * A number given as a JSON number or a numeric string (forms submit strings; "1,500" is fine).
 * Unlike z.coerce it rejects booleans, empty strings and other junk instead of turning them
 * into 1 / 0.
 */
export const numeric = (message = "숫자를 입력해 주세요.") =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const n = parseAmountText(v);
    return Number.isNaN(n) ? v : n;
  }, z.number({ error: (issue) => (issue.input === undefined || issue.input === "" ? message : "숫자로 입력해 주세요.") }).finite(message));

/** The banner above a form with field errors: says how many, not just "check your input". */
export function invalidFormMessage(fields: Record<string, string>): string {
  const count = Object.keys(fields).length;
  return count > 1 ? `${count}개 항목을 확인해 주세요.` : "표시된 항목을 확인해 주세요.";
}
