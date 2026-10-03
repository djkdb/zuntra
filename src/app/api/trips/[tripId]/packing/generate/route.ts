import { guardWrite, handleApi, requireApiUser } from "@/server/http";
import { generatePacking } from "@/server/services/packing-service";

export const maxDuration = 60;

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/packing/generate">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return generatePacking(tripId, user.id);
  });
}
