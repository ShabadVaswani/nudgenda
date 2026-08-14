import { minuteFromLocalDay } from './homeRange.ts';
import type { CalendarEvent, CalendarEventDraft } from '@/calendar/types';

export const RESCHEDULE_SNAP_MINUTES = 15;

function eventDate(value: CalendarEvent['start']) {
  const raw = value.dateTime ?? value.date;
  return raw ? new Date(raw) : undefined;
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function snappedStartMinute({
  durationMinutes,
  maximumMinute = 1440,
  originalStartMinute,
  pixelsPerMinute,
  scrollDelta = 0,
  translationY,
}: {
  durationMinutes: number;
  maximumMinute?: number;
  originalStartMinute: number;
  pixelsPerMinute: number;
  scrollDelta?: number;
  translationY: number;
}) {
  const maximum = Math.max(0, maximumMinute - durationMinutes);
  const rawMinute = originalStartMinute + (translationY + scrollDelta) / pixelsPerMinute;
  return clamp(
    Math.round(rawMinute / RESCHEDULE_SNAP_MINUTES) * RESCHEDULE_SNAP_MINUTES,
    0,
    maximum,
  );
}

export function shiftedEventTimes(
  event: CalendarEvent,
  targetStartMinute: number,
  referenceDay?: Date,
): Pick<CalendarEventDraft, 'start' | 'end'> {
  const originalStart = eventDate(event.start);
  const originalEnd = eventDate(event.end);
  if (!originalStart || !originalEnd || !event.start.dateTime || !event.end.dateTime) {
    throw new Error('Only timed events can be moved');
  }

  const duration = Math.max(60_000, originalEnd.getTime() - originalStart.getTime());
  const nextStart = new Date(referenceDay ?? originalStart);
  nextStart.setHours(0, targetStartMinute, 0, 0);
  const nextEnd = new Date(nextStart.getTime() + duration);

  return {
    end: {
      ...event.end,
      dateTime: nextEnd.toISOString(),
    },
    start: {
      ...event.start,
      dateTime: nextStart.toISOString(),
    },
  };
}

export function conflictingEvents(
  events: CalendarEvent[],
  movingEventId: string,
  targetStartMinute: number,
  targetEndMinute: number,
  referenceDay?: Date,
) {
  return events.filter((event) => {
    if (event.id === movingEventId || !event.start.dateTime || !event.end.dateTime) return false;
    const start = eventDate(event.start);
    const end = eventDate(event.end);
    if (!start || !end) return false;
    const startMinute = referenceDay
      ? minuteFromLocalDay(start, referenceDay)
      : start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60;
    const endMinute = referenceDay
      ? minuteFromLocalDay(end, referenceDay)
      : end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60;
    return startMinute < targetEndMinute && endMinute > targetStartMinute;
  });
}

export function formatMinuteOfDay(minute: number) {
  const date = new Date();
  date.setHours(0, Math.round(minute), 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
