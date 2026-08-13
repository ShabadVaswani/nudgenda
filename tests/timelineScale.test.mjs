import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assignTimelineLanes,
  BASE_HOUR_HEIGHT,
  getAdaptiveHourHeight,
  getVisualEventDuration,
  MAX_HOUR_HEIGHT,
} from '../src/calendar/timelineScale.ts';

test('keeps the standard scale when all events are at least an hour long', () => {
  assert.equal(getAdaptiveHourHeight([60, 90, 120]), BASE_HOUR_HEIGHT);
});

test('expands the scale enough to recognize 10- and 15-minute blocks', () => {
  assert.equal(getAdaptiveHourHeight([10, 60]), MAX_HOUR_HEIGHT);
  assert.equal(getAdaptiveHourHeight([15, 60]), 120);
});

test('uses a 10-minute visual minimum without changing true duration data', () => {
  assert.equal(getVisualEventDuration(5), 10);
  assert.equal(getVisualEventDuration(10), 10);
  assert.equal(getVisualEventDuration(30), 30);
});

test('puts visually overlapping minimum-height events into separate lanes', () => {
  const result = assignTimelineLanes([
    { endMinute: 545, id: 'first', startMinute: 540 },
    { endMinute: 550, id: 'second', startMinute: 545 },
    { endMinute: 570, id: 'third', startMinute: 560 },
  ]);

  assert.deepEqual(
    result.map(({ id, lane, laneCount, visualEndMinute }) => ({
      id,
      lane,
      laneCount,
      visualEndMinute,
    })),
    [
      { id: 'first', lane: 0, laneCount: 2, visualEndMinute: 550 },
      { id: 'second', lane: 1, laneCount: 2, visualEndMinute: 555 },
      { id: 'third', lane: 0, laneCount: 1, visualEndMinute: 570 },
    ],
  );
});
