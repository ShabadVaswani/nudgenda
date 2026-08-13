import assert from 'node:assert/strict';
import test from 'node:test';

import { openDeviceCalendarEvent } from '../src/calendar/openDeviceEvent.ts';

test('opens a device event with a non-null options object', async () => {
  let receivedOptions;
  await openDeviceCalendarEvent('event-1', async (eventId) => {
    assert.equal(eventId, 'event-1');
    return {
      async openInCalendar(options) {
        receivedOptions = options;
      },
    };
  });
  assert.deepEqual(receivedOptions, {});
});

test('turns missing event failures into a recoverable message', async () => {
  await assert.rejects(
    openDeviceCalendarEvent('missing', async () => {
      throw new Error('Native record not found');
    }),
    /may have been removed/i,
  );
});

test('turns missing calendar-handler failures into a recoverable message', async () => {
  await assert.rejects(
    openDeviceCalendarEvent('event-1', async () => ({
      async openInCalendar() {
        throw new Error('No Activity found to handle Intent');
      },
    })),
    /no calendar app is available/i,
  );
});
