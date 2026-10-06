import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, type TripMemberRole } from "@/generated/prisma/client";
import { fromDbDate } from "@/lib/dates";
import {
  acceptInviteSchema,
  createInviteSchema,
  memberPatchSchema,
  participantSchema,
} from "@/lib/validation/members";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { parseOrThrow } from "@/server/validate";
import { assertTripAccess } from "./trip-service";

const INVITE_DAYS = 14;
const ROLE_RANK: Record<TripMemberRole, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };

const displayName = (user: { name: string | null; email: string }) => user.name?.trim() || user.email.split("@")[0]!;

// ───────────────────────────── Participants (who shares costs) ─────────────────────────────

/**
 * Every member gets a participant row (their name in settlements). Trips created before
 * participants existed, and members who joined, are filled in lazily here.
 */
export async function ensureParticipants(tripId: string, tx: Prisma.TransactionClient = db) {
  const members = await tx.tripMember.findMany({
    where: { tripId, user: { participations: { none: { tripId } } } },
    select: { userId: true, user: { select: { name: true, email: true } } },
  });
  if (members.length === 0) return;
  await tx.tripParticipant.createMany({
    data: members.map((m) => ({ tripId, userId: m.userId, name: displayName(m.user) })),
    skipDuplicates: true,
  });
}

export async function listParticipants(tripId: string) {
  await ensureParticipants(tripId);
  const rows = await db.tripParticipant.findMany({
    where: { tripId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, userId: true, leftAt: true, _count: { select: { paid: true, shares: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    userId: p.userId,
    /** Left the trip: still settles past expenses, not part of new splits. */
    left: p.leftAt !== null,
    inUse: p._count.paid + p._count.shares > 0,
  }));
}

export type ParticipantView = Awaited<ReturnType<typeof listParticipants>>[number];

export async function addParticipant(tripId: string, userId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const { name } = parseOrThrow(participantSchema, raw);
  await db.$transaction(async (tx) => {
    await lockTrip(tx, tripId);
    const count = await tx.tripParticipant.count({ where: { tripId } });
    if (count >= 30) throw new AppError("VALIDATION", "함께하는 사람은 30명까지 추가할 수 있어요.");
    await tx.tripParticipant.create({ data: { tripId, name } });
  });
  return listParticipants(tripId);
}

export async function renameParticipant(tripId: string, userId: string, participantId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const { name } = parseOrThrow(participantSchema, raw);
  const { count } = await db.tripParticipant.updateMany({ where: { id: participantId, tripId }, data: { name } });
  if (count === 0) throw notFound("사람");
  return listParticipants(tripId);
}

export async function removeParticipant(tripId: string, userId: string, participantId: string) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const p = await db.tripParticipant.findFirst({
    where: { id: participantId, tripId },
    select: { userId: true, _count: { select: { paid: true, shares: true } } },
  });
  if (!p) throw notFound("사람");
  if (p.userId) throw new AppError("VALIDATION", "여행에 참여 중인 사람은 여기서 뺄 수 없어요. 멤버 목록에서 내보내 주세요.");
  if (p._count.paid + p._count.shares > 0) {
    throw new AppError("CONFLICT", "이 사람이 낸 돈이나 나눠 낸 지출이 있어요. 해당 지출을 먼저 고쳐 주세요.");
  }
  await db.tripParticipant.delete({ where: { id: participantId } });
  return listParticipants(tripId);
}

// ───────────────────────────── Members & invites ─────────────────────────────

export async function getMembers(tripId: string, userId: string) {
  const myRole = await assertTripAccess(tripId, userId);
  const [members, invites, participants] = await Promise.all([
    db.tripMember.findMany({
      where: { tripId },
      orderBy: { createdAt: "asc" },
      select: { userId: true, role: true, createdAt: true, user: { select: { name: true, email: true } } },
    }),
    myRole === "OWNER"
      ? db.tripInvite.findMany({
          where: { tripId, revokedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          select: { id: true, token: true, role: true, expiresAt: true },
        })
      : Promise.resolve([]),
    listParticipants(tripId),
  ]);
  return {
    myRole,
    members: members.map((m) => ({
      userId: m.userId,
      // The name they go by on this trip (picked when joining), same as in the cost split.
      name: participants.find((p) => p.userId === m.userId)?.name ?? displayName(m.user),
      accountName: displayName(m.user),
      // Emails are only shown to the owner, who manages the list.
      email: myRole === "OWNER" || m.userId === userId ? m.user.email : null,
      role: m.role,
      isMe: m.userId === userId,
      joinedAt: m.createdAt.toISOString(),
    })),
    invites: invites.map((i) => ({ id: i.id, token: i.token, role: i.role, expiresAt: i.expiresAt.toISOString() })),
    participants,
  };
}

export type MembersData = Awaited<ReturnType<typeof getMembers>>;

export async function createInvite(tripId: string, userId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "OWNER");
  const { role } = parseOrThrow(createInviteSchema, raw);
  // One live link per role: making a new one retires the old, so a leaked link can be cut off.
  // The trip row lock keeps two simultaneous "new link" clicks from leaving two links alive.
  await db.$transaction(async (tx) => {
    await lockTrip(tx, tripId);
    await tx.tripInvite.updateMany({ where: { tripId, role, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.tripInvite.create({
      data: {
        tripId,
        role,
        createdById: userId,
        token: randomBytes(18).toString("base64url"),
        expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  });
  await track("create_invite", { userId, tripId, properties: { role } });
  return getMembers(tripId, userId);
}

export async function revokeInvite(tripId: string, userId: string, inviteId: string) {
  await assertTripAccess(tripId, userId, "OWNER");
  const invite = await db.tripInvite.findFirst({ where: { id: inviteId, tripId }, select: { id: true } });
  if (!invite) throw notFound("초대");
  await db.tripInvite.updateMany({ where: { id: inviteId, revokedAt: null }, data: { revokedAt: new Date() } });
  return getMembers(tripId, userId);
}

export async function updateMemberRole(tripId: string, userId: string, memberUserId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "OWNER");
  const { role } = parseOrThrow(memberPatchSchema, raw);
  const target = await db.tripMember.findUnique({ where: { tripId_userId: { tripId, userId: memberUserId } }, select: { role: true } });
  if (!target) throw notFound("멤버");
  if (target.role === "OWNER") throw new AppError("VALIDATION", "여행을 만든 사람의 권한은 바꿀 수 없어요.");
  await db.tripMember.update({ where: { tripId_userId: { tripId, userId: memberUserId } }, data: { role } });
  return getMembers(tripId, userId);
}

/**
 * The owner removes someone, or a member leaves. Their name stays in past expenses but is left
 * out of new splits. Removing someone also retires the live invite links they may still hold.
 */
export async function removeMember(tripId: string, userId: string, memberUserId: string) {
  const myRole = await assertTripAccess(tripId, userId);
  const leaving = memberUserId === userId;
  if (!leaving && myRole !== "OWNER") throw new AppError("FORBIDDEN", "멤버를 내보낼 권한이 없어요.");
  const target = await db.tripMember.findUnique({ where: { tripId_userId: { tripId, userId: memberUserId } }, select: { role: true } });
  if (!target) throw notFound("멤버");
  if (target.role === "OWNER") throw new AppError("VALIDATION", "여행을 만든 사람은 나갈 수 없어요. 여행을 삭제해 주세요.");
  const now = new Date();
  await db.$transaction([
    db.tripMember.delete({ where: { tripId_userId: { tripId, userId: memberUserId } } }),
    // Stays linked to the account (so a later rejoin picks it back up) but is marked as gone.
    db.tripParticipant.updateMany({ where: { tripId, userId: memberUserId }, data: { leftAt: now } }),
    ...(leaving ? [] : [db.tripInvite.updateMany({ where: { tripId, revokedAt: null }, data: { revokedAt: now } })]),
  ]);
  return leaving ? null : getMembers(tripId, userId);
}

// ───────────────────────────── Joining ─────────────────────────────

async function liveInvite(token: string) {
  const invite = await db.tripInvite.findUnique({
    where: { token },
    select: {
      id: true,
      tripId: true,
      role: true,
      expiresAt: true,
      revokedAt: true,
      trip: { select: { title: true, destination: true, startDate: true, endDate: true, owner: { select: { name: true, email: true } } } },
    },
  });
  if (!invite) return { state: "invalid" as const };
  if (invite.revokedAt || invite.expiresAt <= new Date()) return { state: "expired" as const };
  return { state: "ok" as const, invite };
}

/**
 * What the join page shows before the user accepts. Signed-out visitors (userId null) see who
 * invited them and to which trip, but not the names on the trip.
 */
export async function getInvitePreview(token: string, userId: string | null) {
  const found = await liveInvite(token);
  if (found.state !== "ok") return { state: found.state };
  const { invite } = found;
  const membership = userId
    ? await db.tripMember.findUnique({ where: { tripId_userId: { tripId: invite.tripId, userId } }, select: { role: true } })
    : null;
  const memberCount = await db.tripMember.count({ where: { tripId: invite.tripId } });
  const unclaimed = !userId ? [] : await db.tripParticipant.findMany({
    where: { tripId: invite.tripId, userId: null, leftAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  return {
    state: "ok" as const,
    tripId: invite.tripId,
    role: invite.role,
    alreadyMember: Boolean(membership),
    memberCount,
    expiresAt: invite.expiresAt.toISOString(),
    trip: {
      title: invite.trip.title,
      destination: invite.trip.destination,
      startDate: fromDbDate(invite.trip.startDate),
      endDate: fromDbDate(invite.trip.endDate),
      ownerName: displayName(invite.trip.owner),
    },
    unclaimed,
  };
}

export async function acceptInvite(token: string, userId: string, raw: unknown) {
  const { participantId } = parseOrThrow(acceptInviteSchema, raw);
  const found = await liveInvite(token);
  if (found.state === "invalid") throw notFound("초대");
  if (found.state === "expired") throw new AppError("VALIDATION", "만료되었거나 취소된 초대 링크예요. 새 링크를 받아 주세요.");
  const { invite } = found;
  const tripId = invite.tripId;
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } });

  try {
    await joinTrip(tripId, userId, invite.role, participantId, displayName(user));
  } catch (error) {
    // A double tap sends two accepts; the loser of the race hits the unique keys. Same outcome.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
  await track("accept_invite", { userId, tripId, properties: { role: invite.role } });
  return { tripId };
}

async function joinTrip(tripId: string, userId: string, role: TripMemberRole, participantId: string | undefined, name: string) {
  await db.$transaction(async (tx) => {
    const existing = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } }, select: { role: true } });
    if (!existing) {
      await tx.tripMember.create({ data: { tripId, userId, role: role } });
    } else if (ROLE_RANK[role] > ROLE_RANK[existing.role]) {
      // A link never lowers what someone already has.
      await tx.tripMember.update({ where: { tripId_userId: { tripId, userId } }, data: { role: role } });
    }
    const mine = await tx.tripParticipant.findUnique({ where: { tripId_userId: { tripId, userId } }, select: { id: true } });
    if (mine) {
      // Coming back: the same name (and its history) is theirs again.
      await tx.tripParticipant.update({ where: { id: mine.id }, data: { leftAt: null } });
      return;
    }
    if (participantId) {
      const { count } = await tx.tripParticipant.updateMany({
        where: { id: participantId, tripId, userId: null, leftAt: null },
        data: { userId },
      });
      if (count === 1) return;
    }
    await tx.tripParticipant.create({ data: { tripId, userId, name } });
  });
}

/** Serialises changes that check-then-write per trip (invite links, participant limit). */
async function lockTrip(tx: Prisma.TransactionClient, tripId: string) {
  await tx.$queryRaw`SELECT id FROM "Trip" WHERE id = ${tripId} FOR UPDATE`;
}
