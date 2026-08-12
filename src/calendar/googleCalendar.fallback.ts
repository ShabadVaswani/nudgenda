import type { GoogleCalendarBridge } from '@/calendar/googleCalendar.types';

export const googleCalendarFallback: GoogleCalendarBridge = {
  isAvailable: false,
  isConfigured: false,
  async connect() {
    throw new Error('Google Calendar web access is only available in the browser');
  },
  async disconnect() {
    // There is no browser token to revoke on native platforms.
  },
  async prepare() {
    // Google Identity Services is only loaded by the web implementation.
  },
};
