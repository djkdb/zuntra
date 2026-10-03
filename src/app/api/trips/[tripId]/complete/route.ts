import { completeTrip, reopenTrip } from "@/server/ai/travel-reporter";
import { guardWrite, handleApi, requireApiUser } from "@/server/http";

export const maxDuration = 60;

/** End the trip and build the AI travel report. */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/complete">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return completeTrip(tripId, user.id);
  });
}

/** Reopen a completed trip. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/trips/[tripId]/complete">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return reopenTrip(tripId, user.id);
  });
}
