import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { reflowItineraryDay } from "@/server/services/itinerary-service";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/days/[dayId]/reflow">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, dayId } = await ctx.params;
    return reflowItineraryDay(tripId, user.id, dayId, await readJson(request));
  });
}
