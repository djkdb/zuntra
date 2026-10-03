import { db } from "@/server/db";

// Public and unauthenticated: cache the DB probe briefly so it cannot be used to load the pool.
let last: { at: number; ok: boolean } | null = null;

export async function GET() {
  if (!last || Date.now() - last.at > 10_000) {
    const ok = await db.$queryRaw`SELECT 1`.then(
      () => true,
      () => false,
    );
    last = { at: Date.now(), ok };
  }
  return last.ok
    ? Response.json({ status: "ok" })
    : Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
}
