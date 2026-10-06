"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Shows a one-off toast after a redirect (e.g. `?deleted=1`) and strips the flag from the URL
 * so refreshing or sharing the link does not repeat it.
 */
export function FlashToast({ message }: { message: string }) {
  const shown = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    window.scrollTo({ top: 0 });
    toast.success(message);
    const next = new URLSearchParams(searchParams);
    for (const key of ["created", "updated", "deleted", "welcome", "joined"]) next.delete(key);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [message, pathname, router, searchParams]);

  return null;
}
