import "server-only";

/** USD per 1M tokens [input, output]. Unknown models fall back to DEFAULT; mock is free. */
const PRICES: Record<string, [number, number]> = {
  mock: [0, 0],
  "gpt-5": [1.25, 10],
  "gpt-5-mini": [0.25, 2],
  "gpt-5-nano": [0.05, 0.4],
  "gpt-4.1": [2, 8],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4o-mini": [0.15, 0.6],
};
const DEFAULT: [number, number] = [1.25, 10];

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(PRICES)
    .sort((a, b) => b.length - a.length)
    .find((k) => model === k || model.startsWith(`${k}-`));
  const [inp, out] = key ? PRICES[key]! : DEFAULT;
  return (inputTokens * inp + outputTokens * out) / 1_000_000;
}
