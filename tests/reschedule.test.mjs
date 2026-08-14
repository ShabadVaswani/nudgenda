import assert from 'node:assert/strict';
import test from 'node:test';

import {
  conflictingEvents,
  shiftedEventTimes,
  snappedStartMinute,
} from '../src/calendar/reschedule.ts';

test('snaps drag movement to 15 minutes and preserves the event inside the day', () => {
  assert.equal(
    snappedStartMinute({
      durationMinutes: 60,
      originalStartMinute: 600,
      pixelsPerMinute: 2,
      translationY: 44,
    }),
    615,
  );
  assert.equal(
    snappedStartMinute({
      durationMinutes: 90,
      originalStartMinute: 1380,
      pixelsPerMinute: 1,
      translationY: 200,
    }),
    1350,
  );
});

test('accounts for scrolling while an event is being dragged', () => {
  assert.equal(
    snappedStartMinute({
      durationMinutes: 30,
      originalStartMinute: 480,
      pixelsPerMinute: 1,
      scrollDelta: 30,
      translationY: 0,
    }),
    510,
  );
});

test('changes only start and end while preserving duration and time-zone metadata', () => {
  const event = {
    calendarId: 'primary',
    end: { dateTime: '2026-08-13T15:00:00.000Z', timeZone: 'America/New_York' },
    id: 'event',
    start: { dateTime: '2026-08-13T14:00:00.000Z', timeZone: 'America/New_York' },
    summary: 'Focus',
  };
  const result = shiftedEventTimes(event, 12 * 60);
  assert.equal(new Date(result.end.dateTime).getTime() - new Date(result.start.dateTime).getTime(), 3_600_000);
  assert.equal(result.start.timeZone, 'America/New_York');
  assert.deepEqual(Object.keys(result).sort(), ['end', 'start']);
});

test('reports overlaps without treating touching event edges as conflicts', () => {
  const events = [
    {
      calendarId: 'primary',
      end: { dateTime: '2026-08-13T10:00:00' },
      id: 'before',
      start: { dateTime: '2026-08-13T09:00:00' },
      summary: 'Before',
    },
    {
      calendarId: 'primary',
      end: { dateTime: '2026-08-13T10:30:00' },
      id: 'overlap',
      start: { dateTime: '2026-08-13T09:45:00' },
      summary: 'Overlap',
    },
  ];
  assert.deepEqual(
    conflictingEvents(events, 'moving', 10 * 60, 11 * 60).map((event) => event.id),
    ['overlap'],
  );
});

test('can snap and move an event into the tomorrow section', () => {
  assert.equal(
    snappedStartMinute({
      durationMinutes: 60,
      maximumMinute: 2880,
      originalStartMinute: 23 * 60,
      pixelsPerMinute: 1,
      translationY: 120,
    }),
    25 * 60,
  );

  const event = {
    calendarId: 'primary',
    end: { dateTime: '2026-08-13T11:00:00' },
    id: 'event',
    start: { dateTime: '2026-08-13T10:00:00' },
    summary: 'Focus',
  };
  const referenceDay = new Date(2026, 7, 13, 12, 0);
  const shifted = shiftedEventTimes(event, 1440 + 8 * 60, referenceDay);
  const shiftedStart = new Date(shifted.start.dateTime);
  assert.equal(shiftedStart.getDate(), 14);
  assert.equal(shiftedStart.getHours(), 8);
});
