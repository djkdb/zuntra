"use client";

import { type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

/**
 * useQuery seeded with server-rendered data. `initialData` alone is ignored when the cache
 * already holds the key (e.g. restored from localStorage, or an older visit), which showed
 * stale lists right after a reload. Here the server copy replaces anything cached before this
 * component mounted; changes made after mounting (mutations) are kept. Until that swap has
 * happened the hook returns the server copy, so hydration renders exactly what the server did
 * even when a restored cache already holds older data for the key.
 */
export function useSeededQuery<T>({
  queryKey,
  queryFn,
  initialData,
  staleTime,
}: {
  queryKey: QueryKey;
  /** Override the default freshness, e.g. 0 for data other people change (who joined). */
  staleTime?: number;
  queryFn: (ctx: { signal: AbortSignal }) => Promise<T>;
  initialData?: T;
}) {
  const qc = useQueryClient();
  const [mountedAt] = useState(() => Date.now());
  const seeded = useRef<T | undefined>(undefined);
  const [hydrating, setHydrating] = useState(initialData !== undefined);
  const query = useQuery({ queryKey, queryFn, initialData, ...(staleTime !== undefined ? { staleTime } : {}) });

  useEffect(() => {
    if (initialData === undefined || seeded.current === initialData) return;
    seeded.current = initialData;
    const state = qc.getQueryState(queryKey);
    if (state?.data !== initialData && (state?.dataUpdatedAt ?? 0) <= mountedAt) qc.setQueryData(queryKey, initialData);
    setHydrating(false);
    // queryKey is an inline array; its content is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, initialData, mountedAt, JSON.stringify(queryKey)]);

  if (hydrating && initialData !== undefined) return { ...query, data: initialData } as typeof query;
  return query;
}
