import { requestOpenRouterJson } from './openRouterRequest.ts';

export type OpenRouterTextUsage = {
  completionTokens: number;
  costUsd?: number;
  promptTokens: number;
  totalTokens: number;
};

type OpenRouterResponse = {
  choices?: { message?: { content?: string } }[];
  error?: {
    code?: number | string;
    message?: string;
    metadata?: { provider_name?: string; raw?: string };
  };
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
  const { payload } = await requestOpenRouterJson<OpenRouterResponse>({
    apiKey: options.apiKey,
    body: {
      max_tokens: options.maxTokens,
      messages: [
        { content: options.system, role: 'system' },
        { content: options.user, role: 'user' },
      ],
      model: options.model,
      stream: false,
      temperature: 0,
    },
    title: options.title,
    validate: (responsePayload) => Boolean(
      responsePayload.choices?.[0]?.message?.content?.trim(),
    ),
  });
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
}
