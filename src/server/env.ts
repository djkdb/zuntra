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
  /** "openai" when a key is present, else the deterministic mock. Force with AI_PROVIDER=mock. */
  AI_PROVIDER: z.enum(["openai", "mock"]).optional(),
  AI_MODEL_DEFAULT: z.string().default("gpt-5-mini"),
  AI_MODEL_PLANNER: z.string().optional(),
  AI_MODEL_COMPANION: z.string().optional(),
  /** Hard ceiling on estimated AI spend per user per day (USD). */
  AI_DAILY_BUDGET_USD: z.coerce.number().positive().default(0.5),
  WEATHER_PROVIDER: z.enum(["open-meteo", "mock"]).default("open-meteo"),
  MAPS_PROVIDER: z.enum(["osm", "mock"]).default("osm"),
  STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".storage"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("trip-photos"),
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
