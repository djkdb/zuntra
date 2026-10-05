import { AppError } from "@/server/errors";
import { attachment, expensesToCsv, itineraryToCsv, itineraryToIcs } from "@/server/export/trip-export";
import { errorResponse, requireApiUser } from "@/server/http";
import { getBudget } from "@/server/services/budget-service";
import { getItinerary } from "@/server/services/itinerary-service";

/**
 * Downloads: ?format=ics (calendar), ?format=csv&what=itinerary|expenses (spreadsheet).
 * Any trip member can export; it's their data too.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/trips/[tripId]/export">) {
  try {
    const user = await requireApiUser();
    const { tripId } = await ctx.params;
    const params = new URL(request.url).searchParams;
    const format = params.get("format");
    const headers = (type: string, name: string, ext: string) => ({
      "Content-Type": type,
      "Content-Disposition": attachment(name, ext),
      "Cache-Control": "private, no-store",
    });

    if (format === "ics") {
      const itinerary = await getItinerary(tripId, user.id);
      return new Response(itineraryToIcs(itinerary), { headers: headers("text/calendar; charset=utf-8", itinerary.trip.title, "ics") });
    }
    if (format === "csv" && params.get("what") === "expenses") {
      const [budget, itinerary] = await Promise.all([getBudget(tripId, user.id), getItinerary(tripId, user.id)]);
      return new Response(expensesToCsv(budget), { headers: headers("text/csv; charset=utf-8", `${itinerary.trip.title} 경비`, "csv") });
    }
    if (format === "csv") {
      const itinerary = await getItinerary(tripId, user.id);
      return new Response(itineraryToCsv(itinerary), { headers: headers("text/csv; charset=utf-8", `${itinerary.trip.title} 일정`, "csv") });
    }
    throw new AppError("VALIDATION", "format은 ics 또는 csv여야 해요.");
  } catch (error) {
    return errorResponse(error);
  }
}
