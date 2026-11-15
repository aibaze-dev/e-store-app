// Minimal OpenAI REST client. It relies only on fetch, available in the Convex runtime.
const API = 'https://api.openai.com/v1';
export const DEFAULT_MODEL = 'gpt-6.1-sol';

// Asks for a JSON document that follows `schema` (Structured Outputs, strict mode).
// Returns null on any failure; the caller decides what to tell the person.
export async function generateJson(apiKey: string, input: {
  model: string; system: string; user: string; schemaName: string; schema: Record<string, unknown>;
}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        messages: [{ role: 'system', content: input.system }, { role: 'user', content: input.user }],
        response_format: { type: 'json_schema', json_schema: { name: input.schemaName, strict: true, schema: input.schema } },
      }),
    });
  } catch (error) {
    console.error('OpenAI request failed', error instanceof Error ? error.name : 'unknown');
    return null;
  }
  const body = await response.json().catch(() => null);
  const message = body?.choices?.[0]?.message;
  if (!response.ok || typeof message?.content !== 'string' || message.refusal) {
    console.error('OpenAI completion failed', response.status, body?.error?.type, body?.error?.code, message?.refusal ? 'refusal' : '');
    return null;
  }
  try {
    return JSON.parse(message.content);
  } catch {
    console.error('OpenAI returned invalid JSON');
    return null;
  }
}
