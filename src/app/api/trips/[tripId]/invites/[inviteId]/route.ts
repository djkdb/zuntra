import { guardWrite, handleApi, requireApiUser } from "@/server/http";
import { revokeInvite } from "@/server/services/member-service";

export async function DELETE(request: Request, ctx: RouteContext<"/api/trips/[tripId]/invites/[inviteId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, inviteId } = await ctx.params;
    return revokeInvite(tripId, user.id, inviteId);
  });
}
