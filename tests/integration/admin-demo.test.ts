import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminMetrics } from "@/server/admin/metrics";
import { track } from "@/server/analytics/track";
import { createTestTrip, createUser, db, resetDb } from "../helpers/db";

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/server/auth/session", async () => {
  const { db } = await import("@/server/db");
  return {
    getCurrentUser: async () =>
      session.userId
        ? db.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true, image: true, role: true, onboardedAt: true } })
        : null,
  };
});
const adminRoute = await import("@/app/api/admin/metrics/route");
const demoRoute = await import("@/app/api/demo/companion/route");

beforeEach(async () => {
  await resetDb();
  session.userId = null;
});
afterAll(() => db.$disconnect());

describe("admin metrics", () => {
  it("is hidden from non-admins and open to admins", async () => {
    const user = await createUser();
    session.userId = user.id;
    expect((await adminRoute.GET(new Request("http://localhost/api/admin/metrics"))).status).toBe(404);
    await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    expect((await adminRoute.GET(new Request("http://localhost/api/admin/metrics"))).status).toBe(200);
  });

  it("aggregates users, trips, AI usage, approval rate, funnel — and hides rare destinations", async () => {
    const [a, b] = await Promise.all([createUser(), createUser()]);
    await createTestTrip(a.id, { destination: "도쿄" });
    await createTestTrip(b.id, { destination: "도쿄" });
    await createTestTrip(b.id, { destination: "아무도모르는마을" });
    await db.aIUsageLog.createMany({
      data: [
        { feature: "PLANNER", model: "mock", latencyMs: 1000, success: true, userId: a.id },
        { feature: "COMPANION", model: "mock", latencyMs: 3000, success: false, errorCode: "TIMEOUT", userId: a.id },
      ],
    });
    await track("ai_action_decided", { userId: a.id, properties: { approved: true } });
    await track("ai_action_decided", { userId: a.id, properties: { approved: false } });
    await track("signup", { userId: a.id });
    await track("signup", { userId: b.id });

    const m = await getAdminMetrics(30);
    expect(m.users.total).toBe(2);
    expect(m.trips.total).toBe(3);
    expect(m.ai).toMatchObject({ requests: 2, avgLatencyMs: 2000, errorRate: 0.5, actionApprovalRate: 0.5 });
    expect(m.ai.errors).toEqual([{ code: "TIMEOUT", count: 1 }]);
    expect(m.popularDestinations).toEqual([{ destination: "도쿄", trips: 2 }]);
    expect(m.funnel.find((f) => f.event === "signup")!.users).toBe(2);
    expect(m.funnel.find((f) => f.event === "create_trip")!.users).toBe(2);
  });
});

describe("demo companion", () => {
  const body = {
    message: "지금 너무 피곤해",
    dayNumber: 2,
    budget: 300000,
    spent: 10000,
    items: [
      { ref: "i1", title: "센소지", category: "CULTURE", startMinute: 0, durationMinutes: 60, travelMinutesFromPrev: null, status: "DONE", lat: 35.71, lng: 139.79 },
      { ref: "i2", title: "아메요코", category: "SHOPPING", startMinute: 1300, durationMinutes: 60, travelMinutesFromPrev: 10, status: "PLANNED", lat: 35.71, lng: 139.77 },
    ],
  };
  const post = (b: unknown) =>
    demoRoute.POST(new Request("http://localhost/api/demo/companion", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.random()}` }, body: JSON.stringify(b) }));

  it("answers without a session and without touching the database", async () => {
    const res = await post(body);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.actions[0]).toMatchObject({ type: "REMOVE_PLACE", ref: "i2" });
    expect(await db.aIUsageLog.count()).toBe(0);
    expect(await db.aIMessage.count()).toBe(0);
  });

  it("validates its input", async () => {
    expect((await post({ ...body, items: Array(20).fill(body.items[0]) })).status).toBe(400);
    expect((await post({ ...body, message: "" })).status).toBe(400);
  });
});
