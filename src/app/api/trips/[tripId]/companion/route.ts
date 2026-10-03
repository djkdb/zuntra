import { getConversation, sendMessage } from "@/server/ai/trip-companion";
import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";

export const maxDuration = 60;

export async function GET(_request: Request, ctx: RouteContext<"/api/trips/[tripId]/companion">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { tripId } = await ctx.params;
    return getConversation(tripId, user.id);
  });
}

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/companion">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return sendMessage(tripId, user.id, await readJson(request));
  });
}
