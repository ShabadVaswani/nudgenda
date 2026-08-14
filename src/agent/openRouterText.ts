const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_REQUEST_ATTEMPTS = 2;

export type OpenRouterTextUsage = {
  completionTokens: number;
  costUsd?: number;
  promptTokens: number;
  totalTokens: number;
};

type OpenRouterResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string; metadata?: { provider_name?: string; raw?: string } };
  usage?: {
    completion_tokens?: number;
    cost?: number;
    prompt_tokens?: number;
    total_tokens?: number;
  };
};

export async function requestOpenRouterText(options: {
  apiKey: string;
  maxTokens?: number;
  model: string;
  system: string;
  title: string;
  user: string;
}) {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        body: JSON.stringify({
          max_tokens: options.maxTokens,
          messages: [
            { content: options.system, role: 'system' },
            { content: options.user, role: 'user' },
          ],
          model: options.model,
          stream: false,
          temperature: 0,
        }),
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/ShabadVaswani/nudgenda',
          'X-Title': options.title,
        },
        method: 'POST',
        signal: controller.signal,
      });
      const raw = await response.text();
      let payload: OpenRouterResponse;
      try {
        payload = JSON.parse(raw) as OpenRouterResponse;
      } catch {
        throw new Error(`OpenRouter returned unreadable JSON (${response.status}).`);
      }
      if (!response.ok || payload.error) {
        const details = [
          payload.error?.message,
          payload.error?.metadata?.provider_name &&
            `provider: ${payload.error.metadata.provider_name}`,
          payload.error?.metadata?.raw?.slice(0, 240),
        ]
          .filter(Boolean)
          .join(' — ');
        throw new Error(details || `OpenRouter request failed (${response.status}).`);
      }
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error(`${options.model} returned an empty response.`);
      return {
        content,
        usage: {
          completionTokens: payload.usage?.completion_tokens ?? 0,
          costUsd: payload.usage?.cost,
          promptTokens: payload.usage?.prompt_tokens ?? 0,
          totalTokens: payload.usage?.total_tokens ?? 0,
        } satisfies OpenRouterTextUsage,
      };
    } catch (error) {
      lastError =
        error instanceof Error && error.name === 'AbortError'
          ? new Error(`${options.model} timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`)
          : error instanceof Error
            ? error
            : new Error(`${options.model} request failed.`);
      if (attempt < MAX_REQUEST_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error(`${options.model} request failed.`);
}
