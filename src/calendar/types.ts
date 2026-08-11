export type CalendarDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

export type CalendarReminder = {
  method: 'email' | 'popup';
  minutes: number;
};

export type CalendarEvent = {
  id: string;
  calendarId: string;
  calendarColor?: string;
  calendarName?: string;
  summary: string;
  description?: string;
  location?: string;
  colorId?: string;
  htmlLink?: string;
  start: CalendarDateTime;
  end: CalendarDateTime;
  reminders?: {
    useDefault: boolean;
    overrides?: CalendarReminder[];
  };
};

export type CalendarEventDraft = Omit<CalendarEvent, 'id' | 'htmlLink'>;

export interface CalendarRepository {
  create(event: CalendarEventDraft): Promise<CalendarEvent>;
  listDay(day: Date, calendarId?: string): Promise<CalendarEvent[]>;
  open?(eventId: string): Promise<void>;
  remove(eventId: string, calendarId?: string): Promise<void>;
  update(
    eventId: string,
    changes: Partial<CalendarEventDraft>,
    calendarId?: string,
  ): Promise<CalendarEvent>;
}
