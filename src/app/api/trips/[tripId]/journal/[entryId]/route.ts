import { guardWrite, handleApi, readJson, requireApiUser } from "@/server/http";
import { deleteJournalEntry, updateJournalEntry } from "@/server/services/journal-service";

export async function PATCH(request: Request, ctx: RouteContext<"/api/trips/[tripId]/journal/[entryId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, entryId } = await ctx.params;
    return updateJournalEntry(tripId, user.id, entryId, await readJson(request));
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/trips/[tripId]/journal/[entryId]">) {
  return handleApi(async () => {
    const user = await requireApiUser();
    await guardWrite(request, user.id);
    const { tripId, entryId } = await ctx.params;
    return deleteJournalEntry(tripId, user.id, entryId);
  });
}
