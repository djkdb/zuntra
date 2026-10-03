import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { type AIProvider, AIProviderError, type AIRequest } from "../provider";

/**
 * OpenAI Responses API with strict JSON-schema structured output.
 * The key is read server-side only; nothing here is importable from client code.
 */
export function createOpenAIProvider(apiKey: string): AIProvider {
  const client = new OpenAI({ apiKey, timeout: 45_000, maxRetries: 1 });

  return {
    name: "openai",
    async generate<T extends z.ZodType>(request: AIRequest<T>) {
      try {
        const response = await client.responses.create({
          model: request.model,
          instructions: request.system,
          input: request.input,
          max_output_tokens: request.maxOutputTokens ?? 4000,
          text: { format: zodTextFormat(request.schema as never, request.schemaName) },
          store: false,
        });
        const text = response.output_text;
        if (!text) throw new AIProviderError("BAD_OUTPUT", "Empty model output");
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new AIProviderError("BAD_OUTPUT", "Model output is not JSON");
        }
        return {
          data,
          model: response.model,
          usage: {
            inputTokens: response.usage?.input_tokens ?? 0,
            outputTokens: response.usage?.output_tokens ?? 0,
          },
        };
      } catch (error) {
        if (error instanceof AIProviderError) throw error;
        if (error instanceof OpenAI.APIConnectionTimeoutError) throw new AIProviderError("TIMEOUT", "OpenAI timeout");
        if (error instanceof OpenAI.RateLimitError) throw new AIProviderError("RATE_LIMIT", "OpenAI rate limit");
        if (error instanceof OpenAI.AuthenticationError) throw new AIProviderError("CONFIG", "OpenAI authentication failed");
        throw new AIProviderError("UPSTREAM", error instanceof Error ? error.message : "OpenAI error");
      }
    },
  };
}
