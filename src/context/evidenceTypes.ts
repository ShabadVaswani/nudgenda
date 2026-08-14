export type ContextEvidence = {
  id: string;
  observedAt?: string;
  role: 'assistant' | 'user';
  text: string;
};

export type ModelUsage = {
  completionTokens: number;
  costUsd?: number;
  promptTokens: number;
  totalTokens: number;
};
