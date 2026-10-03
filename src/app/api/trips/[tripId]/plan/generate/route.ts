import { generatePlan } from "@/server/ai/trip-planner";
import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";

// Planning several days can take a while with a real model.
export const maxDuration = 120;

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/plan/generate">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return generatePlan(tripId, user.id, await readJson(request));
  });
}
