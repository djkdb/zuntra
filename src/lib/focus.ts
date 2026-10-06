import { useRef } from "react";

/**
 * Where keyboard focus goes when a dialog closes. Our dialogs are mostly opened from code (no
 * Radix Trigger), so Radix has nothing to return focus to. Remember the element focused each
 * time the dialog opens (the content wrapper can stay mounted across openings) and focus it
 * again; if it is gone by then (a menu item, an empty-state button replaced by new content),
 * focus the page's main heading instead of dropping to <body>.
 */
export function useDialogReturnFocus(
  onCloseAutoFocus?: (event: Event) => void,
  onOpenAutoFocus?: (event: Event) => void,
) {
  const opener = useRef<Element | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      // Fires before focus moves into the dialog, so this is still what opened it.
      opener.current = document.activeElement;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const from = opener.current;
      const target =
        from instanceof HTMLElement && from.isConnected && from !== document.body
          ? from
          : (["#main h1", "#main h2", "#main"].map((s) => document.querySelector<HTMLElement>(s)).find(Boolean) ?? null);
      if (!target) return;
      event.preventDefault();
      if (target !== from && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    },
  };
}

/**
 * Call before removing a list row: returns a function that, once the row is gone, focuses the
 * first control of the row after it (or before it), else the page's main heading, so keyboard
 * users do not fall back to <body>.
 */
export function focusAfterRemoval(row: Element | null): () => void {
  const neighbor = row?.nextElementSibling ?? row?.previousElementSibling ?? null;
  const control = neighbor?.querySelector<HTMLElement>("button, a[href], input, [tabindex]:not([tabindex='-1'])") ?? null;
  return () => {
    let frames = 0;
    const settle = () => {
      // Optimistic removals render a moment later; wait (briefly) until the row is really gone.
      if (row?.isConnected && frames++ < 30) return void requestAnimationFrame(settle);
      const active = document.activeElement;
      if (active && active !== document.body && active.isConnected && !row?.contains(active)) return;
      const target =
        control?.isConnected ? control : (["#main h1", "#main h2", "#main"].map((s) => document.querySelector<HTMLElement>(s)).find(Boolean) ?? null);
      if (!target) return;
      if (target !== control && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };
    requestAnimationFrame(settle);
  };
}
