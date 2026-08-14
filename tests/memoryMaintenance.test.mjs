import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compactionBatch,
  isNightlyConsolidationDue,
  parseConsolidationOutput,
  validateContextNotebook,
} from '../src/memory/maintenance.ts';
import { EMPTY_CONTEXT_NOTEBOOK, EMPTY_MEMORY_STATE } from '../src/memory/types.ts';

function messages(count, content = 'short message') {
  return Array.from({ length: count }, (_, index) => ({
    content,
    createdAt: `2026-08-13T12:${String(index).padStart(2, '0')}:00.000Z`,
    id: `chat-${index}`,
    role: index % 2 ? 'assistant' : 'user',
  }));
}

test('compacts the oldest 20 after more than 30 uncompressed messages', () => {
  const state = { ...EMPTY_MEMORY_STATE, messages: messages(31) };
  assert.deepEqual(
    compactionBatch(state).map((item) => item.id),
    messages(20).map((item) => item.id),
  );
});

test('uses the character threshold while retaining the newest ten messages', () => {
  const state = { ...EMPTY_MEMORY_STATE, messages: messages(12, 'x'.repeat(3_000)) };
  assert.deepEqual(
    compactionBatch(state).map((item) => item.id),
    ['chat-0', 'chat-1'],
  );
});

test('nightly consolidation is due after 9 PM or for messages from an earlier day', () => {
  const today = { ...EMPTY_MEMORY_STATE, messages: messages(1) };
  assert.equal(isNightlyConsolidationDue(today, new Date('2026-08-13T20:00:00')), false);
  assert.equal(isNightlyConsolidationDue(today, new Date('2026-08-13T21:00:00')), true);
  assert.equal(isNightlyConsolidationDue(today, new Date('2026-08-14T08:00:00')), true);
});

test('nightly consolidation observes a persisted failure cooldown', () => {
  const state = {
    ...EMPTY_MEMORY_STATE,
    lastNightlyAttemptAt: '2026-08-13T21:30:00',
    messages: messages(1),
  };
  assert.equal(isNightlyConsolidationDue(state, new Date('2026-08-13T22:00:00')), false);
  assert.equal(isNightlyConsolidationDue(state, new Date('2026-08-14T04:00:00')), true);
});

test('parses the two Markdown documents from nightly consolidation', () => {
  assert.deepEqual(
    parseConsolidationOutput(`${EMPTY_CONTEXT_NOTEBOOK}\n===DAILY_HISTORY===\n# Daily memory\n- Done.`),
    { history: '# Daily memory\n- Done.', notebook: EMPTY_CONTEXT_NOTEBOOK },
  );
});

test('accepts common nightly separator variations and a daily heading fallback', () => {
  assert.deepEqual(
    parseConsolidationOutput(`${EMPTY_CONTEXT_NOTEBOOK}\n=== DAILY HISTORY ===\n# Daily memory\n- Done.`),
    { history: '# Daily memory\n- Done.', notebook: EMPTY_CONTEXT_NOTEBOOK },
  );
  assert.deepEqual(
    parseConsolidationOutput(`${EMPTY_CONTEXT_NOTEBOOK}\n# Daily memory\n- Done.`),
    { history: '# Daily memory\n- Done.', notebook: EMPTY_CONTEXT_NOTEBOOK },
  );
});

test('validates notebook headings, citations, and source IDs', () => {
  const valid = `${EMPTY_CONTEXT_NOTEBOOK}\n- Remember this. [source: chat-1]`;
  assert.deepEqual(validateContextNotebook(valid, new Set(['chat-1'])), []);
  const errors = validateContextNotebook(
    `${EMPTY_CONTEXT_NOTEBOOK}\n- Unsupported. [source: missing]`,
    new Set(['chat-1']),
  );
  assert.match(errors.join(' '), /Unknown source IDs: missing/);
});
