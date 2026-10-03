import "server-only";
import { z } from "zod";
import type { ExpenseCategory, Mood, PlaceCategory, Prisma } from "@/generated/prisma/client";
import { diffDaysIso, fromDbDate } from "@/lib/dates";
import { CATEGORY_LABELS } from "@/lib/itinerary";
import type { TravelReportView } from "@/lib/report";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { assertTripAccess } from "@/server/services/trip-service";
import { runAI } from "./guard";
import { REPORTER_SCHEMA_NAME, type ReporterContext, reporterInput, reporterSystemPrompt } from "./prompts/reporter";
import { reportNarrativeSchema } from "./schemas/reporter";

const storedReportSchema = z.object({ version: z.literal(1) }).passthrough();
const NOT_A_PLACE: PlaceCategory[] = ["LODGING", "AIRPORT", "TRANSPORT"];

/** Ends the trip (status COMPLETED) and builds its report. Idempotent. */
export async function completeTrip(tripId: string, userId: string) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { status: true } });
  if (trip.status !== "COMPLETED") {
    await db.trip.update({ where: { id: tripId }, data: { status: "COMPLETED", completedAt: new Date() } });
    await track("complete_trip", { userId, tripId });
  }
  return generateReport(tripId, userId);
}

export async function reopenTrip(tripId: string, userId: string) {
  await assertTripAccess(tripId, userId, "EDITOR");
  await db.trip.update({ where: { id: tripId }, data: { status: "ACTIVE", completedAt: null } });
  return { status: "ACTIVE" as const };
}

export async function getReport(tripId: string, userId: string): Promise<TravelReportView | null> {
  await assertTripAccess(tripId, userId);
  const report = await db.travelReport.findUnique({ where: { tripId } });
  if (!report || !storedReportSchema.safeParse(report.content).success) return null;
  return report.content as unknown as TravelReportView;
}

/**
 * Numbers are computed here (deterministic, verifiable); the model only writes the narrative
 * from those numbers and the traveler's own journal.
 */
export async function generateReport(tripId: string, userId: string): Promise<TravelReportView> {
  await assertTripAccess(tripId, userId, "EDITOR");
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      budget: true,
      owner: { select: { travelProfile: { select: { styles: true } } } },
      days: { include: { items: { include: { place: true } } } },
      expenses: { select: { category: true, amount: true } },
      journalEntries: { orderBy: { entryDate: "asc" }, include: { place: true, photos: { select: { id: true } } } },
      photos: { select: { id: true, journalEntry: { select: { rating: true } } } },
    },
  });
  if (trip.status !== "COMPLETED") throw new AppError("CONFLICT", "여행을 종료한 뒤에 리포트를 만들 수 있어요.");

  const startDate = fromDbDate(trip.startDate);
  const endDate = fromDbDate(trip.endDate);
  const allItems = trip.days.flatMap((d) => d.items).filter((i) => !NOT_A_PLACE.includes(i.category));
  const done = allItems.filter((i) => i.status === "DONE");
  const visited = done.length > 0 ? done : allItems.filter((i) => i.status !== "SKIPPED");

  const byCategoryMap = new Map<ExpenseCategory, number>();
  for (const e of trip.expenses) byCategoryMap.set(e.category, (byCategoryMap.get(e.category) ?? 0) + Number(e.amount));
  const totalSpent = [...byCategoryMap.values()].reduce((s, n) => s + n, 0);

  const catCount = new Map<PlaceCategory, number>();
  for (const i of visited) catCount.set(i.category, (catCount.get(i.category) ?? 0) + 1);
  const [topCat, topCount] = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  const rated = [...trip.journalEntries].filter((j) => j.place || j.content).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const memorable = rated.find((j) => j.place && !["FOOD", "CAFE"].includes(j.place.category))?.place?.name
    ?? visited.filter((i) => !["FOOD", "CAFE"].includes(i.category)).sort((a, b) => b.durationMinutes - a.durationMinutes)[0]?.title
    ?? null;
  const favoriteFood = rated.find((j) => j.place && ["FOOD", "CAFE"].includes(j.place.category) && (j.rating ?? 0) >= 4)?.place?.name
    ?? visited.find((i) => i.category === "FOOD")?.title
    ?? null;

  const moodCount = new Map<Mood, number>();
  for (const j of trip.journalEntries) if (j.mood) moodCount.set(j.mood, (moodCount.get(j.mood) ?? 0) + 1);

  const coverPhotoIds = [...trip.photos].sort((a, b) => (b.journalEntry?.rating ?? 0) - (a.journalEntry?.rating ?? 0)).slice(0, 4).map((p) => p.id);

  const base: Omit<TravelReportView, "ai"> = {
    version: 1,
    generatedAt: new Date().toISOString(),
    trip: { title: trip.title, destination: trip.destination, startDate, endDate, travelerCount: trip.travelerCount },
    stats: {
      days: diffDaysIso(startDate, endDate) + 1,
      places: visited.length,
      totalSpent,
      currency: trip.currency,
      perPerson: Math.round(totalSpent / Math.max(trip.travelerCount, 1)),
      budget: trip.budget ? Number(trip.budget.totalAmount) : null,
      byCategory: [...byCategoryMap.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
      photos: trip.photos.length,
      journalEntries: trip.journalEntries.length,
    },
    highlights: {
      memorablePlace: memorable,
      favoriteFood,
      topCategory: topCat ? { category: topCat, label: CATEGORY_LABELS[topCat], count: topCount! } : null,
      moods: [...moodCount.entries()].map(([mood, count]) => ({ mood, count })).sort((a, b) => b.count - a.count),
      coverPhotoIds,
    },
  };

  const context: ReporterContext = {
    stats: base.stats,
    highlights: base.highlights,
    trip: base.trip,
    styles: trip.styles.length ? trip.styles : (trip.owner.travelProfile?.styles ?? []),
    journal: trip.journalEntries.slice(-30).map((j) => ({
      date: fromDbDate(j.entryDate),
      rating: j.rating,
      place: j.place?.name ?? null,
      content: j.content.slice(0, 200),
    })),
  };
  const ai = await runAI({
    feature: "REPORTER",
    schemaName: REPORTER_SCHEMA_NAME,
    schema: reportNarrativeSchema,
    system: reporterSystemPrompt(),
    input: reporterInput(context),
    context,
    userId,
    tripId,
    fresh: true,
  });

  const report: TravelReportView = { ...base, ai };
  await db.travelReport.upsert({
    where: { tripId },
    create: { tripId, content: report as unknown as Prisma.InputJsonValue },
    update: { content: report as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
  });
  return report;
}
