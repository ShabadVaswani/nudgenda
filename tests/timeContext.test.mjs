import assert from 'node:assert/strict';
import test from 'node:test';

import { formatAgentLocalTime } from '../src/agent/timeContext.ts';

test('labels the current instant with the user timezone instead of UTC', () => {
  const formatted = formatAgentLocalTime(
    new Date('2026-08-14T02:11:00.000Z'),
    'America/New_York',
  );
  assert.match(formatted, /August 13, 2026/);
  assert.match(formatted, /10:11:00 PM/);
  assert.match(formatted, /EDT/);
});
