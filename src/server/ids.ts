import "server-only";
import { randomBytes } from "node:crypto";

/** URL-safe random id for storage keys (lowercase, 20 chars). */
export function createId(): string {
  return randomBytes(15).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "x");
}
