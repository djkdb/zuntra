"use client";

import { WifiOffIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Registers the service worker (production only) and shows a banner while offline. */
export function OfflineSupport() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  if (online) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-foreground px-4 py-2 text-sm text-background">
      <WifiOffIcon className="size-4" aria-hidden />
      오프라인 상태예요. 저장된 일정은 계속 볼 수 있어요.
    </div>
  );
}

/** Removes cached personal data from this device (on sign-out). */
export function clearLocalTripData() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("tripmate-cache-")) localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR" });
}
