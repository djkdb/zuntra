import { useState } from "react";

/**
 * Where keyboard focus goes when a dialog closes. Radix returns it to the element that opened
 * the dialog, but that element is often gone by then (an empty-state button replaced by the
 * new content, a menu item). Then focus the page's main heading instead of dropping to <body>.
 */
export function useDialogReturnFocus(onCloseAutoFocus?: (event: Event) => void) {
  const [opener] = useState<Element | null>(() => (typeof document === "undefined" ? null : document.activeElement));
  return (event: Event) => {
    onCloseAutoFocus?.(event);
    if (event.defaultPrevented) return;
    if (opener instanceof HTMLElement && opener.isConnected && opener !== document.body) return; // Radix handles it
    const fallback = document.querySelector<HTMLElement>("#main h2, #main h1, #main");
    if (!fallback) return;
    event.preventDefault();
    if (!fallback.hasAttribute("tabindex")) fallback.setAttribute("tabindex", "-1");
    fallback.focus({ preventScroll: true });
  };
}
