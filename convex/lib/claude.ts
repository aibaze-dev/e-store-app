// Minimal Claude client for JSON generation. The Anthropic SDK only needs fetch, available in the Convex runtime.
import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
type Effort = 'low' | 'medium' | 'high';

// Asks for a JSON document that follows `schema` (structured outputs).
// Returns null on any failure; the caller decides what to tell the person.
export async function generateJson(apiKey: string, input: {
  model: string; system: string; user: string; schema: Record<string, unknown>; effort?: Effort;
}): Promise<unknown> {
  // Built per call so the runtime's current fetch is used (tests stub it).
  const client = new Anthropic({ apiKey });
  let message;
  try {
    // Streamed: long quizzes can exceed what a single non-streaming request allows.
    message = await client.beta.messages.stream({
      model: input.model,
      max_tokens: 64000,
      system: input.system,
      messages: [{ role: 'user', content: input.user }],
      output_config: { effort: input.effort ?? 'medium', format: { type: 'json_schema', schema: input.schema } },
      // If the model declines on a safety classifier, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    }).finalMessage();
  } catch (error) {
    console.error('Claude request failed', error instanceof Anthropic.APIError ? error.status : error instanceof Error ? error.name : 'unknown');
    return null;
  }
  const text = message.content.find(block => block.type === 'text');
  if (message.stop_reason !== 'end_turn' || !text || text.type !== 'text') {
    console.error('Claude completion failed', message.stop_reason, message.stop_details?.category ?? '');
    return null;
  }
  try {
    return JSON.parse(text.text);
  } catch {
    console.error('Claude returned invalid JSON');
    return null;
  }
}
