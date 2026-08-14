export type StoredConversationMessage = {
  content: string;
  createdAt: string;
  id: string;
  role: 'assistant' | 'user';
};

export type MemorySource = {
  evidence: { id: string; observedAt?: string; text: string }[];
  id: string;
  importedAt: string;
  name: string;
  originalText: string;
};

export type DailyMemoryHistory = {
  createdAt: string;
  date: string;
  markdown: string;
};

export type MemoryState = {
  compactedThrough: number;
  history: DailyMemoryHistory[];
  lastConsolidatedAt?: string;
  lastConsolidatedMessage: number;
  messages: StoredConversationMessage[];
  notebook: string;
  rollingSummary: string;
  sources: MemorySource[];
  version: 1;
};

export const EMPTY_CONTEXT_NOTEBOOK = `# User context
## Stable preferences

## Conditional scheduling behavior

## Current priorities

## Calendar behavior

## Unresolved or ambiguous

## Historical or one-off context`;

export const EMPTY_MEMORY_STATE: MemoryState = {
  compactedThrough: 0,
  history: [],
  lastConsolidatedMessage: 0,
  messages: [],
  notebook: EMPTY_CONTEXT_NOTEBOOK,
  rollingSummary: '',
  sources: [],
  version: 1,
};
