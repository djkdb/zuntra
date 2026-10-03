import { proposeReschedule } from "@/server/ai/trip-rescheduler";
import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";

export const maxDuration = 60;

/** Returns a preview; nothing is saved until /apply. */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/plan/reschedule">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return proposeReschedule(tripId, user.id, await readJson(request));
  });
}
