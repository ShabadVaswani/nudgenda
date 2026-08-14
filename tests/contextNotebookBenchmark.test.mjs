import assert from 'node:assert/strict';
import test from 'node:test';

import { benchmarkContextNotebook } from '../src/context/contextNotebookBenchmark.ts';

test('benchmark produces a bounded, sectioned score', () => {
  const result = benchmarkContextNotebook({
    notebook: '# User context\n## Stable preferences\n- Always report total study/work time. [source: user-010]\n',
    originalCharacters: 10_000,
    selectedEvidence: [{ id: 'user-010', role: 'user', text: 'How much study time/work time, tell always' }],
  });
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.deepEqual(
    result.sections.map((item) => item.maximum),
    [48, 24, 18, 10],
  );
});

test('benchmark rejects invalid or assistant citations', () => {
  const result = benchmarkContextNotebook({
    notebook: '# User context\n## Stable preferences\n- Invented claim. [source: assistant-001]\n',
    originalCharacters: 1_000,
    selectedEvidence: [],
  });
  const grounding = result.sections.find((item) => item.name === 'Grounding and non-generalization');
  assert.equal(grounding.checks[1].earned, 0);
  assert.equal(grounding.checks[2].earned, 0);
});

test('benchmark recognizes cited bullets and populated Markdown sections', () => {
  const result = benchmarkContextNotebook({
    notebook:
      '# User context\n## Stable preferences\n- Always report total study/work time. [source: user-010].\n## Conditional scheduling behavior\n- Example. [source: user-010]\n## Current priorities\n- Example. [source: user-010]\n## Calendar behavior\n- Example. [source: user-010]\n## Unresolved or ambiguous\n- Example. [source: user-010]\n## Historical or one-off context\n- Example. [source: user-010]\n',
    originalCharacters: 10_000,
    selectedEvidence: [{ id: 'user-010', role: 'user', text: 'How much study time/work time, tell always' }],
  });
  const grounding = result.sections.find((item) => item.name === 'Grounding and non-generalization');
  const usability = result.sections.find((item) => item.name === 'Compression and readability');
  assert.equal(grounding.checks[0].earned, 6);
  assert.equal(usability.checks[1].earned, 5);
});
