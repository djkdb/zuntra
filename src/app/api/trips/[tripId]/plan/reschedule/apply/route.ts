import { applyReschedule } from "@/server/ai/trip-rescheduler";
import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/plan/reschedule/apply">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return applyReschedule(tripId, user.id, await readJson(request));
  });
}
