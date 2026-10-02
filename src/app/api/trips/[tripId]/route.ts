import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { deleteTrip, getTrip, updateTrip } from "@/server/services/trip-service";

export async function GET(_request: Request, ctx: RouteContext<"/api/trips/[tripId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { tripId } = await ctx.params;
    return getTrip(tripId, user.id);
  });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/trips/[tripId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    await updateTrip(tripId, user.id, await readJson(request));
    return getTrip(tripId, user.id);
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/trips/[tripId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    await deleteTrip(tripId, user.id);
  }, 204);
}
