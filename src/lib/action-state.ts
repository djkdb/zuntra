/** Result shape shared by form Server Actions and the forms that render them. */
export interface FormState {
  ok?: boolean;
  message?: string;
  fields?: Record<string, string>;
  /**
   * Echo of the submitted values (never passwords). React resets uncontrolled forms after an
   * action, so forms use these as their defaults to keep what the user typed on error.
   */
  values?: Record<string, string | string[]>;
}

export const initialFormState: FormState = {};

/** Accept only same-site relative paths as post-login redirects (open-redirect guard). */
export function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
