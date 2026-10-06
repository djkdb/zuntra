import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { removeMember, updateMemberRole } from "@/server/services/member-service";

export async function PATCH(request: Request, ctx: RouteContext<"/api/trips/[tripId]/members/[memberId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, memberId } = await ctx.params;
    return updateMemberRole(tripId, user.id, memberId, await readJson(request));
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/trips/[tripId]/members/[memberId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, memberId } = await ctx.params;
    return removeMember(tripId, user.id, memberId);
  });
}
