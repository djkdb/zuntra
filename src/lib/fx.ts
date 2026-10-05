/**
 * Approximate reference rates (USD per unit), used to pre-fill the exchange rate when an expense
 * is entered in another currency. The rate is always shown and editable, and the one used is
 * stored with the expense, so these never silently change past totals.
 */
const USD_PER: Record<string, number> = {
  USD: 1,
  KRW: 0.00073,
  JPY: 0.0067,
  EUR: 1.08,
  GBP: 1.27,
  CNY: 0.14,
  TWD: 0.031,
  THB: 0.028,
  VND: 0.00004,
  AUD: 0.66,
};

const WHOLE_UNITS = ["KRW", "JPY", "VND", "TWD"];

/** Units of `to` for one unit of `from` (reference value). */
export function referenceRate(from: string, to: string): number {
  if (from === to) return 1;
  return (USD_PER[from] ?? 1) / (USD_PER[to] ?? 1);
}

/** Rounds an amount the way the currency is written (no decimals for KRW/JPY…). */
export function roundForCurrency(amount: number, currency: string): number {
  return WHOLE_UNITS.includes(currency) ? Math.round(amount) : Math.round(amount * 100) / 100;
}

export function convertCurrency(amount: number, from: string, to: string, rate = referenceRate(from, to)): number {
  return roundForCurrency(amount * rate, to);
}

const ZONE_CURRENCY: Record<string, string> = {
  "Asia/Seoul": "KRW",
  "Asia/Tokyo": "JPY",
  "Asia/Taipei": "TWD",
  "Asia/Shanghai": "CNY",
  "Asia/Bangkok": "THB",
  "Asia/Ho_Chi_Minh": "VND",
  "Europe/London": "GBP",
  "Europe/Paris": "EUR",
  "America/New_York": "USD",
  "America/Los_Angeles": "USD",
  "Pacific/Honolulu": "USD",
  "Pacific/Guam": "USD",
  "Australia/Sydney": "AUD",
};

/** The currency people pay in at the destination, when we can tell (for the expense form). */
export function localCurrencyFor(timezone: string): string | null {
  return ZONE_CURRENCY[timezone] ?? null;
}
