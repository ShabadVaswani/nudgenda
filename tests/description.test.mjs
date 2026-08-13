import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCalendarDescription } from '../src/calendar/description.ts';

test('converts paragraphs into readable blocks', () => {
  assert.equal(
    normalizeCalendarDescription('<p>Purpose...</p><p>Steps...</p>'),
    'Purpose...\n\nSteps...',
  );
});

test('preserves line breaks and list structure', () => {
  assert.equal(
    normalizeCalendarDescription('<div>Plan<br>Today</div><ul><li>Walk</li><li>Read</li></ul>'),
    'Plan\nToday\n\n• Walk\n• Read',
  );
});

test('decodes named, decimal, and hexadecimal entities', () => {
  assert.equal(
    normalizeCalendarDescription('<p>Tea &amp; toast &#8212; &#x1F44D;&nbsp;</p>'),
    'Tea & toast — 👍',
  );
});

test('removes scripts, styles, and unsupported markup', () => {
  assert.equal(
    normalizeCalendarDescription(
      '<style>p{display:none}</style><p>Hello <span data-x="1">there</span></p><script>alert(1)</script>',
    ),
    'Hello there',
  );
});

test('leaves plain text and non-HTML angle brackets unchanged', () => {
  const plainText = 'Use x < 3 and keep <placeholder> in the notes.\nSecond line.';
  assert.equal(normalizeCalendarDescription(plainText), plainText);
});

test('handles empty and malformed markup safely', () => {
  assert.equal(normalizeCalendarDescription(undefined), '');
  assert.equal(normalizeCalendarDescription(''), '');
  assert.equal(normalizeCalendarDescription('<p>Unclosed paragraph'), 'Unclosed paragraph');
  assert.equal(normalizeCalendarDescription('<p>Safe</p><script>unsafe'), 'Safe');
});
