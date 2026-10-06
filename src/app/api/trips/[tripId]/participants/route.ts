import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { addParticipant } from "@/server/services/member-service";

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/participants">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return addParticipant(tripId, user.id, await readJson(request));
  }, 201);
}
