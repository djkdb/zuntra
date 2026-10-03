"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { DayView } from "@/lib/itinerary";
import { moveWithinDay } from "@/lib/schedule";
import type { Itinerary } from "@/server/services/itinerary-service";

export const itineraryKey = (tripId: string) => ["itinerary", tripId] as const;

type DaysResult = { days: DayView[] };

function mergeDays(current: Itinerary | undefined, days: DayView[]): Itinerary | undefined {
  if (!current) return current;
  const byId = new Map(days.map((d) => [d.id, d]));
  return { ...current, days: current.days.map((d) => byId.get(d.id) ?? d) };
}

export function useItinerary(tripId: string, initialData?: Itinerary) {
  return useQuery({
    queryKey: itineraryKey(tripId),
    queryFn: ({ signal }) => apiFetch<Itinerary>(`/api/trips/${tripId}/itinerary`, { signal }),
    // Server-rendered data counts as fresh from the moment it is hydrated.
    initialData,
  });
}

/** Shared plumbing: apply returned days to the cache, roll back optimistic edits on failure. */
function useDaysMutation<TVars, TResult extends DaysResult = DaysResult>(
  tripId: string,
  request: (vars: TVars) => Promise<TResult>,
  optimistic?: (data: Itinerary, vars: TVars) => Itinerary,
) {
  const qc = useQueryClient();
  const key = itineraryKey(tripId);
  return useMutation({
    mutationFn: request,
    onMutate: async (vars) => {
      if (!optimistic) return { previous: undefined };
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Itinerary>(key);
      if (previous) qc.setQueryData(key, optimistic(previous, vars));
      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(errorMessage(error));
    },
    onSuccess: (result) => {
      qc.setQueryData<Itinerary>(key, (current) => mergeDays(current, result.days));
    },
  });
}

export function useItineraryMutations(tripId: string) {
  const base = `/api/trips/${tripId}`;

  const addItem = useDaysMutation(tripId, (body: Record<string, unknown>) =>
    apiFetch<DaysResult>(`${base}/items`, { method: "POST", body }),
  );

  const updateItem = useDaysMutation(
    tripId,
    ({ itemId, patch }: { itemId: string; patch: Record<string, unknown> }) =>
      apiFetch<DaysResult>(`${base}/items/${itemId}`, { method: "PATCH", body: patch }),
    (data, { itemId, patch }) =>
      "status" in patch && Object.keys(patch).length === 1
        ? {
            ...data,
            days: data.days.map((d) => ({
              ...d,
              items: d.items.map((i) => (i.id === itemId ? { ...i, status: patch.status as typeof i.status } : i)),
            })),
          }
        : data,
  );

  const deleteItem = useDaysMutation(
    tripId,
    (itemId: string) => apiFetch<DaysResult>(`${base}/items/${itemId}`, { method: "DELETE" }),
    (data, itemId) => ({ ...data, days: data.days.map((d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) })) }),
  );

  const moveItem = useDaysMutation(
    tripId,
    (body: { itemId: string; toDayId: string; toIndex: number }) =>
      apiFetch<DaysResult>(`${base}/items/move`, { method: "POST", body }),
    (data, { itemId, toDayId, toIndex }) => {
      const source = data.days.find((d) => d.items.some((i) => i.id === itemId));
      if (!source || source.id !== toDayId) return data; // cross-day moves wait for the server
      return {
        ...data,
        days: data.days.map((d) => (d.id === toDayId ? { ...d, items: moveWithinDay(d.items, itemId, toIndex) } : d)),
      };
    },
  );

  const reflowDay = useDaysMutation(tripId, ({ dayId, fromItemId }: { dayId: string; fromItemId?: string }) =>
    apiFetch<DaysResult & { changes: { id: string }[] }>(`${base}/days/${dayId}/reflow`, {
      method: "POST",
      body: fromItemId ? { fromItemId } : {},
    }),
  );

  const updateDay = useDaysMutation(tripId, ({ dayId, title }: { dayId: string; title: string | null }) =>
    apiFetch<DaysResult>(`${base}/days/${dayId}`, { method: "PATCH", body: { title } }),
  );

  return { addItem, updateItem, deleteItem, moveItem, reflowDay, updateDay };
}
