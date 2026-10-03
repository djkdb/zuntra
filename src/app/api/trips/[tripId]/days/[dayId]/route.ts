import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { updateDay } from "@/server/services/itinerary-service";

export async function PATCH(request: Request, ctx: RouteContext<"/api/trips/[tripId]/days/[dayId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, dayId } = await ctx.params;
    return updateDay(tripId, user.id, dayId, await readJson(request));
  });
}
