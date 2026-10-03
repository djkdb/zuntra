"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";
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
  const [persister] = useState(() =>
    typeof window === "undefined"
      ? undefined
      : createSyncStoragePersister({ storage: window.localStorage, key: `tripmate-cache-${userId}`, throttleTime: 2000 }),
  );

  // Server render: no storage. Providers render no DOM, so hydration still matches.
  if (!persister) return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        buster: CACHE_BUSTER,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === "success" },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
