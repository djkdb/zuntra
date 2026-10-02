export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency,
      maximumFractionDigits: ["KRW", "JPY", "VND"].includes(currency) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("ko-KR")} ${currency}`;
  }
}

/** Single-letter avatar fallback from the display name, else the email. */
export function initialsOf(name: string | null, email: string): string {
  return (name?.trim() || email).slice(0, 1).toUpperCase();
}
