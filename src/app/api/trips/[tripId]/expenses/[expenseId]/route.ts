import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { deleteExpense, updateExpense } from "@/server/services/budget-service";

export async function PATCH(request: Request, ctx: RouteContext<"/api/trips/[tripId]/expenses/[expenseId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, expenseId } = await ctx.params;
    return updateExpense(tripId, user.id, expenseId, await readJson(request));
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/trips/[tripId]/expenses/[expenseId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, expenseId } = await ctx.params;
    return deleteExpense(tripId, user.id, expenseId);
  });
}
