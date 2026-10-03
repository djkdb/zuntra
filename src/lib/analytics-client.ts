/** Fire-and-forget product analytics from the browser (allow-listed events only). */
export function trackClient(name: "ai_suggestion_clicked", data: { tripId?: string; properties?: Record<string, string | number | boolean> } = {}) {
  try {
    const body = JSON.stringify({ name, ...data });
    // keepalive lets the request finish even if the user navigates away.
    void fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // never break the UI for analytics
  }
}
