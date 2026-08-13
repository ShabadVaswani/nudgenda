export type StructuredImportedContext = {
  confirmedFacts: string[];
  constraints: string[];
  preferences: string[];
  summary: string;
  tasks: string[];
  unfinishedItems: string[];
};

export type ImportedContext = {
  extractedText: string;
  importedAt: string;
  sourceName: string;
  structured: StructuredImportedContext;
};
