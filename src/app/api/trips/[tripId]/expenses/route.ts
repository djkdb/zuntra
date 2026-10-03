import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { addExpense } from "@/server/services/budget-service";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/expenses">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return addExpense(tripId, user.id, await readJson(request));
  }, 201);
}
