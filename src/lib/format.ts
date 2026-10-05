// Fixed symbols instead of Intl currency formatting: the output is identical on the server and
// in every browser (ICU versions disagree, which broke hydration), and reads the way Korean
// travellers write it (¥8,000 rather than JP¥8,000).
const MONEY: Record<string, { prefix?: string; suffix?: string; decimals: number }> = {
  KRW: { prefix: "₩", decimals: 0 },
  JPY: { prefix: "¥", decimals: 0 },
  USD: { prefix: "$", decimals: 2 },
  EUR: { prefix: "€", decimals: 2 },
  GBP: { prefix: "£", decimals: 2 },
  AUD: { prefix: "A$", decimals: 2 },
  TWD: { prefix: "NT$", decimals: 0 },
  CNY: { suffix: "위안", decimals: 2 },
  THB: { suffix: "바트", decimals: 2 },
  VND: { suffix: "동", decimals: 0 },
};

function groupDigits(value: number, decimals: number): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split(".") as [string, string | undefined];
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const trimmed = frac && !/^0+$/.test(frac) ? frac : "";
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

export function formatMoney(amount: number, currency: string): string {
  const spec = MONEY[currency] ?? { suffix: ` ${currency}`, decimals: 2 };
  const sign = amount < 0 ? "-" : "";
  return `${sign}${spec.prefix ?? ""}${groupDigits(amount, spec.decimals)}${spec.suffix ?? ""}`;
}

/** Single-letter avatar fallback from the display name, else the email. */
export function initialsOf(name: string | null, email: string): string {
  return (name?.trim() || email).slice(0, 1).toUpperCase();
}

const UNITS: Array<[string, number]> = [["억", 1e8], ["만", 1e4]];

function parseUnder10k(s: string): number {
  if (s === "") return 0;
  const thousands = s.match(/^(\d+(?:\.\d+)?)?천(\d*)$/);
  if (thousands) return Number(thousands[1] ?? 1) * 1000 + Number(thousands[2] || 0);
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
}

/**
 * Reads an amount the way people type it: "1,500,000", "150만", "60만원", "1억 2천만", "3.5만".
 * Returns NaN when the text is not an amount.
 */
export function parseAmountText(text: string): number {
  let rest = text.replace(/[\s,₩¥$]|원|엔|달러/g, "");
  if (rest === "") return Number.NaN;
  if (/^-?\d+(\.\d+)?$/.test(rest)) return Number(rest);
  let total = 0;
  for (const [unit, value] of UNITS) {
    const at = rest.indexOf(unit);
    if (at < 0) continue;
    const head = rest.slice(0, at);
    total += (head === "" ? 1 : parseUnder10k(head)) * value;
    rest = rest.slice(at + 1);
  }
  total += parseUnder10k(rest);
  return total;
}
