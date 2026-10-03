import { handleApi, requireApiUser } from "@/server/http";
import { getItinerary } from "@/server/services/itinerary-service";

export async function GET(_request: Request, ctx: RouteContext<"/api/trips/[tripId]/itinerary">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { tripId } = await ctx.params;
    return getItinerary(tripId, user.id);
  });
}
