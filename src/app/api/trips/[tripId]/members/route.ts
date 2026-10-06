import { handleApi, requireApiUser } from "@/server/http";
import { getMembers } from "@/server/services/member-service";

export async function GET(_request: Request, ctx: RouteContext<"/api/trips/[tripId]/members">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { tripId } = await ctx.params;
    return getMembers(tripId, user.id);
  });
}
