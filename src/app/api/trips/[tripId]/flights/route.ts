import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { addFlight } from "@/server/services/itinerary-service";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/flights">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return addFlight(tripId, user.id, await readJson(request));
  }, 201);
}
