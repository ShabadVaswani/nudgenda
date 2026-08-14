const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models';

export type OpenRouterModel = {
  contextLength?: number;
  id: string;
  name: string;
  priceLabel: string;
};

type ModelsResponse = {
  data?: {
    architecture?: { input_modalities?: string[]; output_modalities?: string[] };
    context_length?: number;
    id?: string;
    name?: string;
    pricing?: { completion?: string; prompt?: string };
  }[];
};

function perMillion(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1_000_000 : undefined;
}

function priceLabel(prompt?: string, completion?: string) {
  const input = perMillion(prompt);
  const output = perMillion(completion);
  if (input === 0 && output === 0) return 'free';
  if (input === undefined && output === undefined) return 'price unavailable';
  return `$${(input ?? 0).toFixed(input && input < 0.1 ? 3 : 2)} in · $${(output ?? 0).toFixed(output && output < 0.1 ? 3 : 2)} out / 1M`;
}

export async function fetchOpenRouterModels(signal?: AbortSignal): Promise<OpenRouterModel[]> {
  const response = await fetch(OPENROUTER_MODELS_ENDPOINT, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Could not load OpenRouter models (${response.status}).`);
  const payload = (await response.json()) as ModelsResponse;
  return (payload.data ?? [])
    .filter((model) => {
      if (!model.id) return false;
      const inputs = model.architecture?.input_modalities;
      const outputs = model.architecture?.output_modalities;
      return (!inputs || inputs.includes('text')) && (!outputs || outputs.includes('text'));
    })
    .map((model) => ({
      contextLength: model.context_length,
      id: model.id!,
      name: model.name || model.id!,
      priceLabel: priceLabel(model.pricing?.prompt, model.pricing?.completion),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
