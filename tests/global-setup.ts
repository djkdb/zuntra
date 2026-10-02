import { execSync } from "node:child_process";
import { config } from "dotenv";

export default function setup() {
  const env = config({ path: ".env.test", quiet: true }).parsed ?? {};
  if (!env.DATABASE_URL?.includes("test")) {
    throw new Error("Refusing to run tests: .env.test DATABASE_URL must point at a *test* database.");
  }
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, ...env } });
}
