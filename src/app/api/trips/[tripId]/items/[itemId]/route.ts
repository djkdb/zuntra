import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { deleteItem, updateItem } from "@/server/services/itinerary-service";

export async function PATCH(request: Request, ctx: RouteContext<"/api/trips/[tripId]/items/[itemId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, itemId } = await ctx.params;
    return updateItem(tripId, user.id, itemId, await readJson(request));
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/trips/[tripId]/items/[itemId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, itemId } = await ctx.params;
    return deleteItem(tripId, user.id, itemId);
  });
}
