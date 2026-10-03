import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { createJournalEntry, getJournal } from "@/server/services/journal-service";

export async function GET(_request: Request, ctx: RouteContext<"/api/trips/[tripId]/journal">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    const { tripId } = await ctx.params;
    return getJournal(tripId, user.id);
  });
}

export async function POST(request: Request, ctx: RouteContext<"/api/trips/[tripId]/journal">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId } = await ctx.params;
    return createJournalEntry(tripId, user.id, await readJson(request));
  }, 201);
}
