import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSelectedUserEvidenceIds } from '../src/context/contextNotebookPipeline.ts';

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
