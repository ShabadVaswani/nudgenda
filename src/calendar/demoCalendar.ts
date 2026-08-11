import type {
  CalendarEvent,
  CalendarEventDraft,
  CalendarRepository,
} from '@/calendar/types';

function atHour(day: Date, hour: number, minute = 0) {
  const date = new Date(day);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function createDemoEvents(day: Date): CalendarEvent[] {
  return [
    {
      id: 'morning-routine',
      calendarId: 'primary',
      colorId: '7',
      description:
        '7:00–7:10   meditation\n7:10–7:20   brush\n7:20–7:40   bath\n7:40–8:00   walk',
      end: { dateTime: atHour(day, 8) },
      reminders: { overrides: [{ method: 'popup', minutes: 10 }], useDefault: false },
      start: { dateTime: atHour(day, 7) },
      summary: 'morning routine',
    },
    {
      id: 'focus-work',
      calendarId: 'primary',
      colorId: '2',
      end: { dateTime: atHour(day, 9, 30) },
      start: { dateTime: atHour(day, 8) },
      summary: 'focus work',
    },
    {
      id: 'lunch',
      calendarId: 'primary',
      colorId: '4',
      end: { dateTime: atHour(day, 10, 30) },
      start: { dateTime: atHour(day, 9, 30) },
      summary: 'lunch',
    },
    {
      id: 'project-work',
      calendarId: 'primary',
      colorId: '5',
      end: { dateTime: atHour(day, 15) },
      start: { dateTime: atHour(day, 12) },
      summary: 'project work',
    },
    {
      id: 'admin',
      calendarId: 'primary',
      colorId: '9',
      end: { dateTime: atHour(day, 17) },
      start: { dateTime: atHour(day, 15) },
      summary: 'admin',
    },
  ];
}

export class DemoCalendarRepository implements CalendarRepository {
  private dayKey = '';
  private events: CalendarEvent[] = [];

  async listDay(day: Date) {
    const nextDayKey = day.toISOString().slice(0, 10);
    if (nextDayKey !== this.dayKey) {
      this.dayKey = nextDayKey;
      this.events = createDemoEvents(day);
    }
    return this.events;
  }

  async create(event: CalendarEventDraft) {
    const created = { ...event, id: `demo-${Date.now()}` };
    this.events.push(created);
    return created;
  }

  async update(eventId: string, changes: Partial<CalendarEventDraft>) {
    const index = this.events.findIndex((event) => event.id === eventId);
    if (index === -1) {
      throw new Error(`Demo event ${eventId} was not found`);
    }
    this.events[index] = { ...this.events[index], ...changes };
    return this.events[index];
  }

  async remove(eventId: string) {
    this.events = this.events.filter((event) => event.id !== eventId);
  }
}
