import { decideAction } from "@/server/ai/actions/executor";
import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";

/** Approve or reject an AI-proposed change: { decision: "approve" | "reject" }. */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/actions/[actionId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, actionId } = await ctx.params;
    return decideAction(tripId, user.id, actionId, await readJson(request));
  });
}
