const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [600, 1_200, 2_400, 4_000, 5_000];

export type OpenRouterErrorPayload = {
  error?: {
    code?: number | string;
    message?: string;
    metadata?: { provider_name?: string; raw?: string };
  };
};

export type OpenRouterRequestResult<T> = {
  attempts: number;
  payload: T;
  status: number;
};

type RequestOptions<T> = {
  apiKey: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
  title: string;
  validate?: (payload: T) => boolean;
};

class RetryableOpenRouterError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RetryableOpenRouterError';
    this.status = status;
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorDetails(payload: OpenRouterErrorPayload, status: number) {
  return (
    [
      payload.error?.message,
      payload.error?.metadata?.provider_name &&
        `provider: ${payload.error.metadata.provider_name}`,
      payload.error?.metadata?.raw?.slice(0, 240),
    ]
      .filter(Boolean)
      .join(' — ') || `OpenRouter request failed (${status}).`
  );
}

export function isRetryableOpenRouterStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function finalMessage(error: Error, attempts: number, timeoutMs: number) {
  if (error.message.includes('API key') || error.message.includes('credits')) return error.message;
  const seconds = Math.round(timeoutMs / 1000);
  if (error instanceof RetryableOpenRouterError || error.name === 'AbortError') {
    return `OpenRouter did not recover after ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'} within ${seconds} seconds. Retry, or choose another model in settings.`;
  }
  return error.message;
}

export async function requestOpenRouterJson<T extends OpenRouterErrorPayload>(
  options: RequestOptions<T>,
): Promise<OpenRouterRequestResult<T>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  let attempts = 0;
  let lastError: Error = new Error('OpenRouter request failed.');

  while (Date.now() - startedAt < timeoutMs) {
    attempts += 1;
    const remaining = timeoutMs - (Date.now() - startedAt);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, remaining));

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        body: JSON.stringify(options.body),
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
      let payload: T;
      try {
        payload = JSON.parse(raw) as T;
      } catch {
        throw new RetryableOpenRouterError(
          `OpenRouter returned unreadable data (${response.status}).`,
          response.status,
        );
      }

      if (!response.ok || payload.error) {
        const message = errorDetails(payload, response.status);
        const code = Number(payload.error?.code ?? response.status);
        if (
          isRetryableOpenRouterStatus(response.status) ||
          isRetryableOpenRouterStatus(code) ||
          (response.ok && (!payload.error?.code || code === response.status))
        ) {
          throw new RetryableOpenRouterError(message, response.status);
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('OpenRouter rejected the API key. Check it in settings.');
        }
        if (response.status === 402) {
          throw new Error('This model needs OpenRouter credits. Add credits or choose a free model.');
        }
        throw new Error(message);
      }

      if (options.validate && !options.validate(payload)) {
        throw new RetryableOpenRouterError('The model returned an unreadable response.');
      }

      return { attempts, payload, status: response.status };
    } catch (error) {
      lastError =
        error instanceof Error && error.name === 'AbortError'
          ? new RetryableOpenRouterError('OpenRouter timed out.')
          : error instanceof TypeError
            ? new RetryableOpenRouterError('Could not reach OpenRouter.')
          : error instanceof Error
            ? error
            : new RetryableOpenRouterError('OpenRouter request failed.');

      if (!(lastError instanceof RetryableOpenRouterError)) throw lastError;
      const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
      const timeLeft = timeoutMs - (Date.now() - startedAt);
      if (timeLeft <= delay + 250) break;
      await sleep(delay);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(finalMessage(lastError, attempts, timeoutMs));
}
