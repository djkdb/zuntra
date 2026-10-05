type Pair = "을/를" | "이/가" | "은/는" | "와/과" | "으로/로";

// Final-consonant reading of the last digit / Latin letter, for words that end in one.
const DIGIT_BATCHIM: Record<string, number> = { "0": 21, "1": 8, "2": 0, "3": 21, "4": 0, "5": 0, "6": 1, "7": 8, "8": 8, "9": 0 };
const LATIN_WITH_BATCHIM = new Set(["l", "m", "n", "r"]);

/** 0 = no final consonant, 8 = ㄹ, anything else = some other final consonant. */
function finalConsonant(word: string): number {
  const text = word.replace(/[\s'"’”)\]}.,!?]+$/u, "");
  const last = text.at(-1);
  if (!last) return 0;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
  if (last in DIGIT_BATCHIM) return DIGIT_BATCHIM[last]!;
  return LATIN_WITH_BATCHIM.has(last.toLowerCase()) ? 4 : 0;
}

/** Picks the right particle for `word`: josa("여권", "을/를") → "을". */
export function josa(word: string, pair: Pair): string {
  const [withBatchim, without] = pair.split("/") as [string, string];
  const jong = finalConsonant(word);
  if (pair === "으로/로") return jong === 0 || jong === 8 ? without : withBatchim;
  return jong === 0 ? without : withBatchim;
}

/** `word` followed by its particle: withJosa("₩7,500", "을/를") → "₩7,500을". */
export const withJosa = (word: string, pair: Pair) => `${word}${josa(word, pair)}`;

/** `word` followed by the polite copula: withCopula("식비") → "식비예요", withCopula("교통") → "교통이에요". */
export const withCopula = (word: string) => `${word}${finalConsonant(word) === 0 ? "예요" : "이에요"}`;
