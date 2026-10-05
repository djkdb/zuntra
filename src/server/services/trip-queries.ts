import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppError } from "@/server/errors";
import { getTrip, listTrips } from "./trip-service";

/** Request-scoped memo so the app shell and the page share one trip query. */
export const listTripsForRequest = cache(listTrips);

/**
 * Loads a trip for a page render (memoized per request so layout + page share it).
 * Missing or inaccessible trips render the 404 page — same response either way.
 */
export const getTripForPage = cache(async (tripId: string, userId: string) => {
  try {
    return await getTrip(tripId, userId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
});

/**
 * Page data for a trip tab, loaded in parallel with the trip itself. A member check failing
 * inside the data loader renders the same 404 page as `getTripForPage`.
 */
export async function tripPageData<T>(tripId: string, userId: string, load: () => Promise<T>) {
  const toNotFound = (error: unknown): never => {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  };
  const [trip, data] = await Promise.all([getTripForPage(tripId, userId), load().catch(toNotFound)]);
  return { trip, data };
}
