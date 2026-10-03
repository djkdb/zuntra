import { generateReport, getReport } from "@/server/ai/travel-reporter";
import { guardWrite, handleApi, requireApiUser } from "@/server/http";

export const maxDuration = 60;

export async function GET(_request: Request, ctx: RouteContext<"/api/trips/[tripId]/report">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { tripId } = await ctx.params;
    return getReport(tripId, user.id);
  });
}

/** Regenerate the report (e.g. after adding more journal entries). */
export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/report">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return generateReport(tripId, user.id);
  });
}
