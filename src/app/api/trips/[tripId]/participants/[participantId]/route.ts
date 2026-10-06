import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { removeParticipant, renameParticipant } from "@/server/services/member-service";

export async function PATCH(request: Request, ctx: RouteContext<"/api/trips/[tripId]/participants/[participantId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, participantId } = await ctx.params;
    return renameParticipant(tripId, user.id, participantId, await readJson(request));
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/trips/[tripId]/participants/[participantId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, participantId } = await ctx.params;
    return removeParticipant(tripId, user.id, participantId);
  });
}
