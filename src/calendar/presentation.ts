import type { CalendarEvent } from '@/calendar/types';
import { normalizeCalendarDescription } from '@/calendar/description';
import { colors } from '@/constants/design';
import type { ScheduleItem } from '@/data/schedule';

const calendarColors: Record<string, string> = {
  '2': colors.lime,
  '4': colors.pink,
  '5': colors.yellow,
  '7': colors.aqua,
  '9': colors.periwinkle,
};

const symbols: Record<string, string> = {
  admin: '☑',
  'focus work': '✓',
  lunch: '♡',
  'morning routine': '≡',
  'project work': '⌁',
};

export function presentCalendarEvent(event: CalendarEvent): ScheduleItem {
  const start = getEventDate(event.start);
  const end = getEventDate(event.end);
  const reminder = event.reminders?.overrides?.[0];
  const description = normalizeCalendarDescription(event.description);

  return {
    canModify: event.canModify !== false,
    calendarName:
      event.calendarName ?? (event.calendarId === 'primary' ? 'Personal' : event.calendarId),
    color: event.calendarColor ?? calendarColors[event.colorId ?? ''] ?? colors.aqua,
    dateLabel: start
      ? new Intl.DateTimeFormat(undefined, {
          day: 'numeric',
          month: 'short',
          weekday: 'short',
        }).format(start)
      : 'All day',
    description: description ? description.split('\n') : undefined,
    endLabel: formatTime(end),
    htmlLink: event.htmlLink,
    id: event.id,
    isRecurring: Boolean(event.isRecurring),
    reminderLabel: reminder ? `${reminder.minutes} min before` : undefined,
    startLabel: formatTime(start),
    symbol: symbols[event.summary.toLowerCase()] ?? '·',
    title: event.summary || '(untitled event)',
  };
}

function getEventDate(value: CalendarEvent['start']) {
  const raw = value.dateTime ?? value.date;
  return raw ? new Date(raw) : undefined;
}

function formatTime(value?: Date) {
  if (!value) return 'All day';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}
