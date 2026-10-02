import "server-only";
import { z } from "zod";

/**
 * Server-side environment, validated once at first access.
 * Secrets live only here; anything the browser needs must use a NEXT_PUBLIC_ variable.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  OPENAI_API_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Only print which keys are invalid — never their values.
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment variables: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}
