import type { CalendarRepository } from '@/calendar/types';

export type GoogleCalendarConnection = {
  accountLabel?: string;
  calendarCount: number;
  repository: CalendarRepository;
};

export interface GoogleCalendarBridge {
  isAvailable: boolean;
  isConfigured: boolean;
  connect(): Promise<GoogleCalendarConnection>;
  disconnect(): Promise<void>;
  prepare(): Promise<void>;
}

export const googleCalendarScopes = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events',
] as const;
