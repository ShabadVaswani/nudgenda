import type { ContextEvidence } from './evidenceTypes.ts';

const CHATGPT_SECTION =
  /^## (Prompt|Response):\s*\n([^\n]+)\s*\n\n([\s\S]*?)(?=^## (?:Prompt|Response):|(?![\s\S]))/gm;
const TARGET_CHUNK_CHARACTERS = 12_000;
const MAX_ASSISTANT_EVIDENCE_CHARACTERS = 1_000;

const encodingReplacements: [RegExp, string][] = [
  [/â€™|â€˜/g, "'"],
  [/â€œ|â€/g, '"'],
  [/â€“|â€”/g, '–'],
  [/â€¦/g, '…'],
  [/Â·/g, '·'],
  [/Â/g, ''],
];

export type ContextPreprocessingResult = {
  chunks: { evidenceIds: string[]; id: string; text: string }[];
  evidence: ContextEvidence[];
  evidenceCharacters: number;
  originalCharacters: number;
  warnings: string[];
};

export function repairCommonEncoding(value: string) {
  return encodingReplacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );
}

function cleanMarkdown(value: string) {
  return repairCommonEncoding(value)
    .replace(/^>.*$/gm, '')
    .replace(/^Worked for .*$/gm, '')
    .replace(/^Powered by .*$/gm, '')
    .replace(/!\[[^\]]*\]\([^\s)]+\)/g, '[attachment omitted]')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function reduceAssistantEvidence(value: string) {
  const cleaned = cleanMarkdown(value);
  if (cleaned.length <= MAX_ASSISTANT_EVIDENCE_CHARACTERS) return cleaned;
  const beginning = cleaned.slice(0, 350);
  const ending = cleaned.slice(-(MAX_ASSISTANT_EVIDENCE_CHARACTERS - 400));
  return `${beginning}\n[assistant detail omitted locally]\n${ending}`;
}

function buildChunks(evidence: ContextEvidence[]) {
  const chunks: ContextPreprocessingResult['chunks'] = [];
  let current: ContextEvidence[] = [];
  let currentLength = 0;

  const flush = () => {
    if (!current.length) return;
    const id = `chunk-${String(chunks.length + 1).padStart(3, '0')}`;
    chunks.push({
      evidenceIds: current.map((item) => item.id),
      id,
      text: current
        .map(
          (item) =>
            `<evidence id=${JSON.stringify(item.id)} role=${JSON.stringify(item.role)} observed_at=${JSON.stringify(item.observedAt ?? '')}>\n${item.text}\n</evidence>`,
        )
        .join('\n\n'),
    });
    current = [];
    currentLength = 0;
  };

  for (const item of evidence) {
    const itemLength = item.text.length + 120;
    if (current.length && currentLength + itemLength > TARGET_CHUNK_CHARACTERS) flush();
    current.push(item);
    currentLength += itemLength;
  }
  flush();
  return chunks;
}

function parseChatGptMarkdown(text: string) {
  const evidence: ContextEvidence[] = [];
  let match: RegExpExecArray | null;
  let userIndex = 0;
  let assistantIndex = 0;
  CHATGPT_SECTION.lastIndex = 0;

  while ((match = CHATGPT_SECTION.exec(text))) {
    const role = match[1] === 'Prompt' ? 'user' : 'assistant';
    const body = role === 'user' ? cleanMarkdown(match[3]) : reduceAssistantEvidence(match[3]);
    if (!body) continue;
    const previous = evidence.at(-1);
    if (previous?.role === role) {
      previous.text =
        role === 'assistant'
          ? reduceAssistantEvidence(`${previous.text}\n${body}`)
          : `${previous.text}\n${body}`;
      continue;
    }
    if (role === 'user') userIndex += 1;
    else assistantIndex += 1;
    evidence.push({
      id: `${role}-${String(role === 'user' ? userIndex : assistantIndex).padStart(3, '0')}`,
      observedAt: match[2].trim(),
      role,
      text: body,
    });
  }
  return evidence;
}

function parseGenericText(text: string) {
  return cleanMarkdown(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map<ContextEvidence>((paragraph, index) => ({
      id: `source-${String(index + 1).padStart(3, '0')}`,
      role: /^(assistant|chatgpt)\s*:/i.test(paragraph) ? 'assistant' : 'user',
      text: paragraph.replace(/^(?:assistant|chatgpt|human|user)\s*:\s*/i, ''),
    }));
}

export function preprocessImportedContext(text: string): ContextPreprocessingResult {
  const normalized = repairCommonEncoding(text).replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
  const parsed = parseChatGptMarkdown(normalized);
  const evidence = parsed.length ? parsed : parseGenericText(normalized);
  const chunks = buildChunks(evidence);
  const evidenceCharacters = evidence.reduce((total, item) => total + item.text.length, 0);
  const warnings: string[] = [];
  if (parsed.length) {
    warnings.push('ChatGPT export detected; internal blockquotes and exporter boilerplate were removed locally.');
  }
  if (evidence.some((item) => item.text.includes('[assistant detail omitted locally]'))) {
    warnings.push('Long assistant replies were reduced locally; user messages were preserved in full.');
  }
  return {
    chunks,
    evidence,
    evidenceCharacters,
    originalCharacters: normalized.length,
    warnings,
  };
}
