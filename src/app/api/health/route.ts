import { db } from "@/server/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
