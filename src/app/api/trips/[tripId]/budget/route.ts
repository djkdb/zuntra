import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { getBudget, setBudget } from "@/server/services/budget-service";

export async function GET(_request: Request, ctx: RouteContext<"/api/trips/[tripId]/budget">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { tripId } = await ctx.params;
    return getBudget(tripId, user.id);
  });
}

export async function PUT(request: Request, ctx: RouteContext<"/api/trips/[tripId]/budget">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return setBudget(tripId, user.id, await readJson(request));
  });
}
