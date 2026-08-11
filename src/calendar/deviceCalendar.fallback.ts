import type { DeviceCalendarBridge } from '@/calendar/deviceCalendar.types';

const unavailable = {
  canAskAgain: false,
  status: 'unavailable' as const,
};

export const deviceCalendarFallback: DeviceCalendarBridge = {
  isAvailable: false,
  async connect() {
    throw new Error('Device calendar access is available in the Android app');
  },
  async getPermission() {
    return unavailable;
  },
  async requestPermission() {
    return unavailable;
  },
};
