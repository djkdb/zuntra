import "server-only";
import { type AIProvider, AIProviderError } from "../provider";

export type MockHandler = (context: never) => unknown;

/**
 * Deterministic provider used without an API key, in tests and in Demo Mode.
 * Each schema has a rule-based handler that reasons over the structured context, so the
 * whole product works end-to-end (and its output still passes the same Zod validation).
 */
export function createMockProvider(handlers: Record<string, MockHandler>): AIProvider {
  return {
    name: "mock",
    async generate(request) {
      const handler = handlers[request.schemaName];
      if (!handler) throw new AIProviderError("CONFIG", `No mock handler for ${request.schemaName}`);
      const data = handler(request.context as never);
      const json = JSON.stringify(data);
      return {
        data: JSON.parse(json),
        model: "mock",
        usage: { inputTokens: Math.ceil(request.input.length / 3), outputTokens: Math.ceil(json.length / 3) },
      };
    },
  };
}
