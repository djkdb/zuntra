import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { moveItem } from "@/server/services/itinerary-service";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/items/move">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return moveItem(tripId, user.id, await readJson(request));
  });
}
