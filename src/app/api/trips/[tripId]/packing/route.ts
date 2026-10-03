import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { addPackingItem, getPacking } from "@/server/services/packing-service";

export async function GET(_request: Request, ctx: RouteContext<"/api/trips/[tripId]/packing">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { tripId } = await ctx.params;
    return getPacking(tripId, user.id);
  });
}

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/packing">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return addPackingItem(tripId, user.id, await readJson(request));
  }, 201);
}
