import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  acceptInvite,
  addParticipant,
  createInvite,
  getInvitePreview,
  getMembers,
  removeMember,
  removeParticipant,
  revokeInvite,
  updateMemberRole,
} from "@/server/services/member-service";
import { addExpense, getBudget } from "@/server/services/budget-service";
import { getTrip } from "@/server/services/trip-service";
import { expectAppError } from "../helpers/assert";
import { createTestTrip, createUser, db, resetDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

async function setup() {
  const [owner, friend] = await Promise.all([createUser({ name: "지민" }), createUser({ name: "민수" })]);
  const { id: tripId } = await createTestTrip(owner.id);
  return { owner, friend, tripId };
}

describe("invites", () => {
  it("lets a friend join with the link's role and adds them to cost splitting", async () => {
    const { owner, friend, tripId } = await setup();
    const data = await createInvite(tripId, owner.id, { role: "EDITOR" });
    const token = data.invites[0]!.token;

    const preview = await getInvitePreview(token, friend.id);
    expect(preview).toMatchObject({ state: "ok", role: "EDITOR", alreadyMember: false });

    await acceptInvite(token, friend.id, {});
    const trip = await getTrip(tripId, friend.id);
    expect(trip.role).toBe("EDITOR");
    const members = await getMembers(tripId, owner.id);
    expect(members.members.map((m) => m.name)).toEqual(["지민", "민수"]);
    expect(members.participants.map((p) => p.name)).toEqual(["지민", "민수"]);
  });

  it("lets the joiner claim a name already used for splitting", async () => {
    const { owner, friend, tripId } = await setup();
    const withName = await addParticipant(tripId, owner.id, { name: "민수(카톡)" });
    const placeholder = withName.find((p) => p.name === "민수(카톡)")!;
    const { invites } = await createInvite(tripId, owner.id, { role: "EDITOR" });
    await acceptInvite(invites[0]!.token, friend.id, { participantId: placeholder.id });
    const { participants } = await getMembers(tripId, owner.id);
    expect(participants).toHaveLength(2);
    expect(participants.find((p) => p.id === placeholder.id)?.userId).toBe(friend.id);
  });

  it("refuses revoked or replaced links, and never lowers an existing role", async () => {
    const { owner, friend, tripId } = await setup();
    const first = (await createInvite(tripId, owner.id, { role: "VIEWER" })).invites[0]!;
    const second = (await createInvite(tripId, owner.id, { role: "VIEWER" })).invites[0]!;
    expect(second.token).not.toBe(first.token);
    await expectAppError(acceptInvite(first.token, friend.id, {}), "VALIDATION");

    const editorLink = (await createInvite(tripId, owner.id, { role: "EDITOR" })).invites.find((i) => i.role === "EDITOR")!;
    await acceptInvite(editorLink.token, friend.id, {});
    await acceptInvite(second.token, friend.id, {});
    expect((await getTrip(tripId, friend.id)).role).toBe("EDITOR");

    await revokeInvite(tripId, owner.id, second.id);
    expect(await getInvitePreview(second.token, friend.id)).toEqual({ state: "expired" });
  });

  it("only the owner manages links and roles", async () => {
    const { owner, friend, tripId } = await setup();
    const { invites } = await createInvite(tripId, owner.id, { role: "EDITOR" });
    await acceptInvite(invites[0]!.token, friend.id, {});
    await expectAppError(createInvite(tripId, friend.id, { role: "EDITOR" }), "FORBIDDEN");
    await expectAppError(updateMemberRole(tripId, friend.id, owner.id, { role: "VIEWER" }), "FORBIDDEN");
    await expectAppError(removeMember(tripId, friend.id, owner.id), "FORBIDDEN");
    // Emails stay private to the owner.
    const seenByFriend = await getMembers(tripId, friend.id);
    expect(seenByFriend.members.find((m) => !m.isMe)?.email).toBeNull();
    expect(seenByFriend.invites).toEqual([]);
  });
});

describe("leaving and removal", () => {
  it("keeps a removed member's name for settlement but drops their access", async () => {
    const { owner, friend, tripId } = await setup();
    const { invites } = await createInvite(tripId, owner.id, { role: "EDITOR" });
    await acceptInvite(invites[0]!.token, friend.id, {});
    expect(await removeMember(tripId, friend.id, friend.id)).toBeNull();
    await expectAppError(getTrip(tripId, friend.id), "NOT_FOUND");
    const { participants } = await getMembers(tripId, owner.id);
    expect(participants.find((p) => p.name === "민수")).toMatchObject({ userId: friend.id, left: true });
    await expectAppError(removeMember(tripId, owner.id, owner.id), "VALIDATION");
  });

  it("removes a name only when no expense uses it", async () => {
    const { owner, tripId } = await setup();
    const list = await addParticipant(tripId, owner.id, { name: "서연" });
    const seoyeon = list.find((p) => p.name === "서연")!;
    const mine = list.find((p) => p.userId === owner.id)!;
    await expectAppError(removeParticipant(tripId, owner.id, mine.id), "VALIDATION");
    expect((await removeParticipant(tripId, owner.id, seoyeon.id)).map((p) => p.name)).toEqual(["지민"]);
  });
});

describe("round-3 regressions", () => {
  it("never charges someone for costs from before they joined or after they left", async () => {
    const { owner, friend, tripId } = await setup();
    await addExpense(tripId, owner.id, { title: "숙소", category: "LODGING", amount: 100000, date: "2026-11-03" });
    const { invites } = await createInvite(tripId, owner.id, { role: "EDITOR" });
    await acceptInvite(invites[0]!.token, friend.id, {});
    let budget = await getBudget(tripId, owner.id);
    expect(budget.settlement!.transfers).toEqual([]); // the 숙소 stays the owner's alone

    await addExpense(tripId, owner.id, { title: "저녁", category: "FOOD", amount: 30000, date: "2026-11-03" });
    await removeMember(tripId, friend.id, friend.id);
    await addExpense(tripId, owner.id, { title: "택시", category: "TRANSPORT", amount: 20000, date: "2026-11-04" });
    budget = await getBudget(tripId, owner.id);
    const minsu = budget.participants.find((p) => p.name === "민수")!;
    expect(minsu.left).toBe(true);
    expect(budget.settlement!.people.find((p) => p.id === minsu.id)!.share).toBe(15000);

    // Coming back re-links the same name instead of creating a second 민수.
    const again = (await createInvite(tripId, owner.id, { role: "EDITOR" })).invites[0]!;
    await acceptInvite(again.token, friend.id, {});
    const after = await getMembers(tripId, owner.id);
    expect(after.participants.filter((p) => p.name === "민수")).toHaveLength(1);
    expect(after.participants.find((p) => p.name === "민수")!.left).toBe(false);
  });

  it("removing someone retires the links they hold", async () => {
    const { owner, friend, tripId } = await setup();
    const { invites } = await createInvite(tripId, owner.id, { role: "VIEWER" });
    await acceptInvite(invites[0]!.token, friend.id, {});
    await removeMember(tripId, owner.id, friend.id);
    await expectAppError(acceptInvite(invites[0]!.token, friend.id, {}), "VALIDATION");
  });

  it("handles a double-tapped accept and two simultaneous new links", async () => {
    const { owner, friend, tripId } = await setup();
    const { invites } = await createInvite(tripId, owner.id, { role: "EDITOR" });
    const results = await Promise.allSettled([1, 2, 3, 4].map(() => acceptInvite(invites[0]!.token, friend.id, {})));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await db.tripParticipant.count({ where: { tripId, userId: friend.id } })).toBe(1);

    await Promise.all([createInvite(tripId, owner.id, { role: "EDITOR" }), createInvite(tripId, owner.id, { role: "EDITOR" })]);
    expect(await db.tripInvite.count({ where: { tripId, role: "EDITOR", revokedAt: null } })).toBe(1);
  });
});
