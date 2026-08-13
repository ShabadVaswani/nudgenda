import assert from 'node:assert/strict';
import test from 'node:test';

import { deduplicateCalendarEvents } from '../src/calendar/deduplicate.ts';

function event(overrides = {}) {
  return {
    calendarId: 'calendar-a',
    description: '<p>Bring notes</p>',
    end: { dateTime: '2026-08-13T11:00:00-04:00', timeZone: 'America/New_York' },
    id: 'event-a',
    location: 'Desk',
    start: { dateTime: '2026-08-13T10:00:00-04:00', timeZone: 'America/New_York' },
    summary: 'Project review',
    ...overrides,
  };
}

test('collapses exact semantic duplicates from different calendars', () => {
  const events = deduplicateCalendarEvents([
    event(),
    event({ calendarColor: '#00ff00', calendarId: 'calendar-b', id: 'event-b' }),
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'event-a');
  assert.deepEqual(events[0].duplicateSources, [
    { calendarId: 'calendar-a', id: 'event-a' },
    { calendarId: 'calendar-b', id: 'event-b' },
  ]);
});

test('normalizes harmless title, description, and timestamp formatting', () => {
  const events = deduplicateCalendarEvents([
    event(),
    event({
      calendarId: 'calendar-b',
      description: 'Bring notes',
      id: 'event-b',
      start: { dateTime: '2026-08-13T14:00:00Z', timeZone: 'America/New_York' },
      summary: '  PROJECT   REVIEW ',
    }),
  ]);
  assert.equal(events.length, 1);
});

test('keeps events with different descriptions or locations', () => {
  const events = deduplicateCalendarEvents([
    event(),
    event({ calendarId: 'calendar-b', description: 'Bring slides', id: 'description-change' }),
    event({ calendarId: 'calendar-c', id: 'location-change', location: 'Conference room' }),
  ]);
  assert.equal(events.length, 3);
});

test('keeps near-duplicates with even small timing differences', () => {
  const events = deduplicateCalendarEvents([
    event(),
    event({
      calendarId: 'calendar-b',
      id: 'event-b',
      start: { dateTime: '2026-08-13T10:01:00-04:00', timeZone: 'America/New_York' },
    }),
  ]);
  assert.equal(events.length, 2);
});

test('keeps recurring-looking instances on different dates separate', () => {
  const events = deduplicateCalendarEvents([
    event(),
    event({
      end: { dateTime: '2026-08-14T11:00:00-04:00', timeZone: 'America/New_York' },
      id: 'next-instance',
      start: { dateTime: '2026-08-14T10:00:00-04:00', timeZone: 'America/New_York' },
    }),
  ]);
  assert.equal(events.length, 2);
});
