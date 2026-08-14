import assert from 'node:assert/strict';
import test from 'node:test';

import {
  minuteFromLocalDay,
  nextLocalDay,
  shouldShowTomorrow,
} from '../src/calendar/homeRange.ts';

test('reveals tomorrow at 6 PM in the device local timezone', () => {
  assert.equal(shouldShowTomorrow(new Date(2026, 7, 13, 17, 59)), false);
  assert.equal(shouldShowTomorrow(new Date(2026, 7, 13, 18, 0)), true);
});

test('maps tomorrow onto the second 24-hour section without elapsed-time DST drift', () => {
  const today = new Date(2026, 7, 13, 20, 0);
  const tomorrow = nextLocalDay(today);
  tomorrow.setHours(8, 15, 0, 0);
  assert.equal(minuteFromLocalDay(tomorrow, today), 1440 + 8 * 60 + 15);
});
