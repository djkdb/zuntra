import { z } from "zod";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { parseOrThrow } from "@/server/validate";

const CLIENT_EVENTS = ["ai_suggestion_clicked"] as const;

const bodySchema = z.object({
  name: z.enum(CLIENT_EVENTS),
  tripId: z.string().max(40).optional(),
  // Only short primitive values — no free text, no personal data.
  properties: z
    .record(z.string().max(32), z.union([z.string().max(40), z.number(), z.boolean()]))
    .refine((p) => Object.keys(p).length <= 8)
    .optional(),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const body = parseOrThrow(bodySchema, await readJson(request));
    // Attach the trip only if the user is actually a member of it.
    const member = body.tripId
      ? await db.tripMember.findUnique({ where: { tripId_userId: { tripId: body.tripId, userId: user.id } }, select: { id: true } })
      : null;
    await track(body.name, { userId: user.id, tripId: member ? body.tripId : null, properties: body.properties });
  }, 204);
}
