import { normalizeCalendarDescription } from './description.ts';
import type { CalendarDateTime, CalendarEvent } from '@/calendar/types';

export type CalendarEventSource = Pick<CalendarEvent, 'calendarId' | 'id'>;

export type DisplayCalendarEvent = CalendarEvent & {
  duplicateSources: CalendarEventSource[];
};

function normalizeText(value?: string) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function normalizeDateTime(value: CalendarDateTime) {
  if (value.date) return `date:${value.date}|tz:${value.timeZone ?? ''}`;
  if (!value.dateTime) return 'missing';
  const parsed = new Date(value.dateTime);
  const instant = Number.isNaN(parsed.getTime()) ? value.dateTime : parsed.toISOString();
  return `dateTime:${instant}|tz:${value.timeZone ?? ''}`;
}

export function getCalendarEventFingerprint(event: CalendarEvent) {
  return [
    normalizeDateTime(event.start),
    normalizeDateTime(event.end),
    normalizeText(event.summary),
    normalizeText(normalizeCalendarDescription(event.description)),
    normalizeText(event.location),
  ].join('\u241F');
}

export function deduplicateCalendarEvents(events: CalendarEvent[]): DisplayCalendarEvent[] {
  const byFingerprint = new Map<string, DisplayCalendarEvent>();

  events.forEach((event) => {
    const fingerprint = getCalendarEventFingerprint(event);
    const existing = byFingerprint.get(fingerprint);
    const source = { calendarId: event.calendarId, id: event.id };
    if (existing) {
      existing.duplicateSources.push(source);
      return;
    }
    byFingerprint.set(fingerprint, { ...event, duplicateSources: [source] });
  });

  return [...byFingerprint.values()];
}
