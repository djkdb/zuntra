/**
 * Generates the Prisma client for Cloudflare Workers (`runtime = "cloudflare"`), which imports
 * the query compiler as a static .wasm module — Workers forbid compiling WASM at runtime.
 * Used only by `npm run cf:build`; afterwards the regular Node client is regenerated.
 */
import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const source = "prisma/schema.prisma";
const target = "prisma/schema.cloudflare.prisma";
const schema = readFileSync(source, "utf8");
const patched = schema.replace(/generator client \{([\s\S]*?)\}/, (block, body) =>
  /runtime\s*=/.test(body) ? block : `generator client {${body}  runtime = "cloudflare"\n}`,
);
if (patched === schema) throw new Error("Could not find the Prisma generator block");
writeFileSync(target, patched);
try {
  execSync(`npx prisma generate --schema ${target}`, { stdio: "inherit" });
} finally {
  rmSync(target, { force: true });
}
