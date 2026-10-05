"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api-client";

const CACHE_BUSTER = "v1";

/**
 * Server state for client components. Successful trip queries are persisted to localStorage
 * (per browser) so an itinerary that was loaded once stays readable without a network.
 * The cache is keyed by user id so a shared device never shows another account's trips.
 */
export function QueryProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 7 * 24 * 60 * 60 * 1000,
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
            refetchOnWindowFocus: true,
            networkMode: "offlineFirst",
          },
          mutations: { networkMode: "online" },
        },
      }),
  );
  // Restore/persist outside React. A provider that flips "restoring" state while the page is
  // still hydrating forces React to client-render streamed Suspense boundaries, which can leave
  // the server-streamed copy of a page in the DOM next to the client one.
  useEffect(() => {
    const persister = createSyncStoragePersister({ storage: window.localStorage, key: `tripmate-cache-${userId}`, throttleTime: 2000 });
    const [unsubscribe] = persistQueryClient({
      queryClient: client,
      persister,
      buster: CACHE_BUSTER,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === "success" },
    });
    return unsubscribe;
  }, [client, userId]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
