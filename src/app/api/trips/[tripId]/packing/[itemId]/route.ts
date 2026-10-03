import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { deletePackingItem, updatePackingItem } from "@/server/services/packing-service";

export async function PATCH(request: Request, ctx: RouteContext<"/api/trips/[tripId]/packing/[itemId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, itemId } = await ctx.params;
    return updatePackingItem(tripId, user.id, itemId, await readJson(request));
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/trips/[tripId]/packing/[itemId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, itemId } = await ctx.params;
    return deletePackingItem(tripId, user.id, itemId);
  });
}
