import type { CalendarRepository } from '@/calendar/types';

export type DeviceCalendarPermissionStatus =
  | 'denied'
  | 'granted'
  | 'undetermined'
  | 'unavailable';

export type DeviceCalendarPermission = {
  canAskAgain: boolean;
  status: DeviceCalendarPermissionStatus;
};

export type DeviceCalendarConnection = {
  accountLabel?: string;
  calendarCount: number;
  repository: CalendarRepository;
};

export interface DeviceCalendarBridge {
  isAvailable: boolean;
  connect(): Promise<DeviceCalendarConnection>;
  getPermission(): Promise<DeviceCalendarPermission>;
  requestPermission(): Promise<DeviceCalendarPermission>;
}
