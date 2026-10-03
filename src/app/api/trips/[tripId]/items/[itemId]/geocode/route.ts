import { guardWrite, handleApi, requireApiUser } from "@/server/http";
import { geocodeItem } from "@/server/services/itinerary-service";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/items/[itemId]/geocode">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, itemId } = await ctx.params;
    return geocodeItem(tripId, user.id, itemId);
  });
}
