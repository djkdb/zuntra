import { useState } from "react";

/**
 * Where keyboard focus goes when a dialog closes. Our dialogs are mostly opened from code (no
 * Radix Trigger), so Radix has nothing to return focus to. Remember the element focused when the
 * dialog mounted and focus it again; if it is gone by then (an empty-state button replaced by the
 * new content, a menu item), focus the page's main heading instead of dropping to <body>.
 */
export function useDialogReturnFocus(onCloseAutoFocus?: (event: Event) => void) {
  const [opener] = useState<Element | null>(() => (typeof document === "undefined" ? null : document.activeElement));
  return (event: Event) => {
    onCloseAutoFocus?.(event);
    if (event.defaultPrevented) return;
    const target =
      opener instanceof HTMLElement && opener.isConnected && opener !== document.body
        ? opener
        : (["#main h1", "#main h2", "#main"].map((s) => document.querySelector<HTMLElement>(s)).find(Boolean) ?? null);
    if (!target) return;
    event.preventDefault();
    if (target !== opener && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
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
  return () =>
    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      const target =
        control?.isConnected ? control : (["#main h1", "#main h2", "#main"].map((s) => document.querySelector<HTMLElement>(s)).find(Boolean) ?? null);
      if (!target) return;
      if (target !== control && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
}
