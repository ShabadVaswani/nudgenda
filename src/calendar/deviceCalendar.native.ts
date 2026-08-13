import * as Calendar from 'expo-calendar';

import type {
  DeviceCalendarBridge,
  DeviceCalendarPermission,
} from '@/calendar/deviceCalendar.types';
import { openDeviceCalendarEvent } from '@/calendar/openDeviceEvent';
import type {
  CalendarEvent,
  CalendarEventDraft,
  CalendarEventUpdateOptions,
  CalendarReminder,
  CalendarRepository,
} from '@/calendar/types';

const GOOGLE_ACCOUNT_TYPE = 'com.google';

function isGoogleCalendar(calendar: Calendar.ExpoCalendar) {
  const sourceType = String(calendar.source?.type ?? '').toLowerCase();
  return sourceType === GOOGLE_ACCOUNT_TYPE || sourceType.includes('google');
}

function isUsableCalendar(calendar: Calendar.ExpoCalendar) {
  return isGoogleCalendar(calendar) && calendar.isSynced !== false && calendar.isVisible !== false;
}

function isWritableCalendar(calendar: Calendar.ExpoCalendar) {
  return isUsableCalendar(calendar) && calendar.allowsModifications;
}

function toPermission(response: Calendar.PermissionResponse): DeviceCalendarPermission {
  return {
    canAskAgain: response.canAskAgain,
    status:
      response.status === 'granted'
        ? 'granted'
        : response.status === 'denied'
          ? 'denied'
          : 'undetermined',
  };
}

function dayBounds(day: Date) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { end, start };
}

function dateValue(value: CalendarEvent['start']) {
  const raw = value.dateTime ?? value.date;
  return raw ? new Date(raw) : undefined;
}

function mapAlarm(alarm: Calendar.Alarm): CalendarReminder | undefined {
  if (alarm.relativeOffset == null) return undefined;
  return {
    method: alarm.method === Calendar.AlarmMethod.EMAIL ? 'email' : 'popup',
    minutes: Math.abs(alarm.relativeOffset),
  };
}

function toEvent(
  event: Calendar.ExpoCalendarEvent,
  calendars: Map<string, Calendar.ExpoCalendar>,
): CalendarEvent {
  const calendar = calendars.get(event.calendarId);
  const reminders = event.alarms.map(mapAlarm).filter((alarm): alarm is CalendarReminder => !!alarm);
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);

  return {
    canModify: Boolean(calendar?.allowsModifications),
    calendarColor: calendar?.color,
    calendarId: event.calendarId,
    calendarName: calendar?.title,
    description: event.notes || undefined,
    end: event.allDay
      ? { date: endDate.toISOString().slice(0, 10) }
      : { dateTime: endDate.toISOString(), timeZone: event.endTimeZone ?? event.timeZone },
    id: event.id,
    isRecurring: Boolean(event.recurrenceRule || event.originalId || event.instanceId),
    location: event.location ?? undefined,
    reminders: reminders.length
      ? { overrides: reminders, useDefault: false }
      : { useDefault: true },
    start: event.allDay
      ? { date: startDate.toISOString().slice(0, 10) }
      : { dateTime: startDate.toISOString(), timeZone: event.timeZone },
    summary: event.title,
    recurringEventId: event.originalId ?? (event.recurrenceRule ? event.id : undefined),
  };
}

function toDeviceDetails(event: Partial<CalendarEventDraft>) {
  const startDate = event.start ? dateValue(event.start) : undefined;
  const endDate = event.end ? dateValue(event.end) : undefined;
  const overrides = event.reminders?.overrides;

  return {
    ...(event.summary !== undefined && { title: event.summary }),
    ...(event.description !== undefined && { notes: event.description }),
    ...(event.location !== undefined && { location: event.location }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
    ...(event.start && { allDay: Boolean(event.start.date && !event.start.dateTime) }),
    ...(overrides && {
      alarms: overrides.map((reminder) => ({
        method:
          reminder.method === 'email' ? Calendar.AlarmMethod.EMAIL : Calendar.AlarmMethod.ALERT,
        relativeOffset: -Math.abs(reminder.minutes),
      })),
    }),
  };
}

class AndroidCalendarRepository implements CalendarRepository {
  constructor(private calendars: Calendar.ExpoCalendar[]) {}

  private calendarMap() {
    return new Map(this.calendars.map((calendar) => [calendar.id, calendar]));
  }

  private writableCalendar(requestedId?: string) {
    const writable = this.calendars.filter(isWritableCalendar);
    const requested = writable.find((calendar) => calendar.id === requestedId);
    const selected = requested ?? writable.find((calendar) => calendar.isPrimary) ?? writable[0];
    if (!selected) {
      throw new Error('No writable synced Google calendar was found on this phone');
    }
    return selected;
  }

  async listDay(day: Date, calendarId?: string) {
    const calendars = calendarId
      ? this.calendars.filter((calendar) => calendar.id === calendarId)
      : this.calendars;
    const { end, start } = dayBounds(day);
    const events = await Calendar.listEvents(calendars, start, end);
    const calendarMap = this.calendarMap();
    return events
      .map((event) => toEvent(event, calendarMap))
      .sort((left, right) => {
        const leftStart = dateValue(left.start)?.getTime() ?? 0;
        const rightStart = dateValue(right.start)?.getTime() ?? 0;
        return leftStart - rightStart;
      });
  }

  async create(event: CalendarEventDraft) {
    const calendar = this.writableCalendar(event.calendarId);
    const created = await calendar.createEvent(toDeviceDetails(event));
    return toEvent(created, this.calendarMap());
  }

  async update(
    eventId: string,
    changes: Partial<CalendarEventDraft>,
    _calendarId?: string,
    options?: CalendarEventUpdateOptions,
  ) {
    const baseId =
      options?.scope === 'single' && options.recurringEventId
        ? options.recurringEventId
        : eventId;
    const event = await Calendar.ExpoCalendarEvent.get(baseId);
    const instanceStart = options?.instanceStart ? dateValue(options.instanceStart) : undefined;
    const target =
      options?.scope === 'single' && instanceStart
        ? event.getOccurrenceSync({ instanceStartDate: instanceStart })
        : event;
    await target.update(toDeviceDetails(changes));
    return toEvent(target, this.calendarMap());
  }

  async remove(eventId: string) {
    const event = await Calendar.ExpoCalendarEvent.get(eventId);
    await event.delete();
  }

  async open(eventId: string) {
    await openDeviceCalendarEvent(eventId, Calendar.ExpoCalendarEvent.get);
  }
}

async function getGoogleCalendars() {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return calendars.filter(isUsableCalendar);
}

export const deviceCalendar: DeviceCalendarBridge = {
  isAvailable: true,
  async connect() {
    const calendars = await getGoogleCalendars();
    if (!calendars.length) {
      throw new Error(
        'No synced Google calendar was found. Add a Google account to Android and enable Calendar sync.',
      );
    }
    const primary = calendars.find((calendar) => calendar.isPrimary) ?? calendars[0];
    return {
      accountLabel: primary.ownerAccount ?? primary.source?.name,
      calendarCount: calendars.length,
      repository: new AndroidCalendarRepository(calendars),
    };
  },
  async getPermission() {
    return toPermission(await Calendar.getCalendarPermissions());
  },
  async requestPermission() {
    return toPermission(await Calendar.requestCalendarPermissions());
  },
};
