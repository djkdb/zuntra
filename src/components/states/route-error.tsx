"use client";

import { useEffect } from "react";
import { ErrorState } from "./error-state";

/** Shared body for `error.tsx` boundaries. */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Only the digest reaches the browser in production; full details stay in server logs.
    if (error.digest) console.error("Route error", error.digest);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <ErrorState onRetry={reset} />
    </div>
  );
}
