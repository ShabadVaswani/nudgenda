import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeNotebookSourceIds,
  parseSelectedUserEvidenceIds,
} from '../src/context/contextNotebookPipeline.ts';

test('accepts only known user IDs from a plain-text filter response', () => {
  const known = new Set(['user-001', 'user-003']);
  assert.deepEqual(
    parseSelectedUserEvidenceIds('user-001\nassistant-002\nUSER-003\nuser-999', known),
    ['user-001', 'user-003'],
  );
});

test('deduplicates repeated source IDs without parsing a JSON profile', () => {
  const known = new Set(['user-004']);
  assert.deepEqual(parseSelectedUserEvidenceIds('user-004\nuser-004', known), ['user-004']);
});

test('restores an import prefix when the notebook writer returns bare user IDs', () => {
  const notebook = `# User context
## Stable preferences
- Keep meals protected. [source: user-004]
## Conditional scheduling behavior
## Current priorities
## Calendar behavior
- Commit immediately. [source: user-010, import-2/user-011]
## Unresolved or ambiguous
## Historical or one-off context`;
  const evidence = [
    { id: 'import-2/user-004', role: 'user', text: 'Do not skip meals.' },
    { id: 'import-2/user-010', role: 'user', text: 'Add it immediately.' },
    { id: 'import-2/user-011', role: 'user', text: 'No confirmation.' },
  ];

  const normalized = normalizeNotebookSourceIds(notebook, evidence);
  assert.match(normalized, /\[source: import-2\/user-004\]/);
  assert.match(normalized, /\[source: import-2\/user-010, import-2\/user-011\]/);
});

test('does not disguise an invented source ID as valid evidence', () => {
  const notebook = `# User context
## Stable preferences
- Invented. [source: user-999]`;
  const normalized = normalizeNotebookSourceIds(notebook, [
    { id: 'import-2/user-004', role: 'user', text: 'Known.' },
  ]);
  assert.match(normalized, /\[source: user-999\]/);
});
