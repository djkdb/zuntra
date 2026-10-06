import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { acceptInvite } from "@/server/services/member-service";

export async function POST(request: Request, ctx: RouteContext<"/api/invites/[token]/accept">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { token } = await ctx.params;
    return acceptInvite(token, user.id, await readJson(request));
  });
}
