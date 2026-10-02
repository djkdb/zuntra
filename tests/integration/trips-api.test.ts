import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestTrip, createUser, db, resetDb } from "../helpers/db";

// Route handlers resolve the user from the session; tests swap in a fixed user.
const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/server/auth/session", async () => {
  const { db } = await import("@/server/db");
  return {
    getCurrentUser: async () =>
      session.userId
        ? db.user.findUnique({
            where: { id: session.userId },
            select: { id: true, name: true, email: true, image: true, role: true, onboardedAt: true },
          })
        : null,
  };
});

const { GET: listTrips, POST: createTrip } = await import("@/app/api/trips/route");
const tripRoute = await import("@/app/api/trips/[tripId]/route");

const ctx = (tripId: string) => ({ params: Promise.resolve({ tripId }) }) as never;
const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/trips", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  await resetDb();
  session.userId = null;
});
afterAll(() => db.$disconnect());

const validBody = {
  title: "오사카 2박 3일",
  destination: "오사카",
  timezone: "Asia/Tokyo",
  startDate: "2026-12-01",
  endDate: "2026-12-03",
  travelerCount: 3,
  currency: "JPY",
  budgetAmount: 90000,
};

describe("/api/trips", () => {
  it("returns 401 without a session", async () => {
    const res = await listTrips();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("creates a trip (201) and lists it", async () => {
    const user = await createUser();
    session.userId = user.id;

    const res = await createTrip(json(validBody));
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.days).toHaveLength(3);
    expect(data.budgetAmount).toBe(90000);

    const list = await (await listTrips()).json();
    expect(list.data.map((t: { id: string }) => t.id)).toEqual([data.id]);
  });

  it("returns 400 with field errors for invalid input", async () => {
    session.userId = (await createUser()).id;
    const res = await createTrip(json({ ...validBody, travelerCount: 0, endDate: "2026-11-01" }));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("VALIDATION");
    expect(Object.keys(error.fields)).toEqual(expect.arrayContaining(["travelerCount", "endDate"]));
  });

  it("rejects non-JSON bodies and cross-origin writes", async () => {
    session.userId = (await createUser()).id;
    const form = new Request("http://localhost:3000/api/trips", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", host: "localhost:3000" },
      body: "title=x",
    });
    expect((await createTrip(form)).status).toBe(400);
    expect((await createTrip(json(validBody, { origin: "https://evil.example" }))).status).toBe(403);
    expect(await db.trip.count()).toBe(0);
  });
});

describe("/api/trips/:tripId", () => {
  it("hides other users' trips (404) for GET, PATCH and DELETE", async () => {
    const [alice, mallory] = await Promise.all([createUser(), createUser()]);
    const { id } = await createTestTrip(alice.id);
    session.userId = mallory.id;

    expect((await tripRoute.GET(new Request("http://localhost:3000"), ctx(id))).status).toBe(404);
    const patch = new Request("http://localhost:3000", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "pwned" }),
    });
    expect((await tripRoute.PATCH(patch, ctx(id))).status).toBe(404);
    expect((await tripRoute.DELETE(new Request("http://localhost:3000", { method: "DELETE" }), ctx(id))).status).toBe(404);
    expect(await db.trip.count()).toBe(1);
  });

  it("lets the owner patch and delete", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    session.userId = user.id;

    const patch = new Request("http://localhost:3000", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "도쿄 먹방 여행", budgetAmount: null }),
    });
    const res = await tripRoute.PATCH(patch, ctx(id));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.title).toBe("도쿄 먹방 여행");
    expect(data.budgetAmount).toBeNull();

    const del = await tripRoute.DELETE(new Request("http://localhost:3000", { method: "DELETE" }), ctx(id));
    expect(del.status).toBe(204);
    expect(await db.trip.count()).toBe(0);
  });
});
