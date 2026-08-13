import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { DemoCalendarRepository } from '@/calendar/demoCalendar';
import { deviceCalendar } from '@/calendar/deviceCalendar';
import type { DeviceCalendarPermissionStatus } from '@/calendar/deviceCalendar.types';
import { googleCalendar } from '@/calendar/googleCalendar';
import type {
  CalendarEvent,
  CalendarEventDraft,
  CalendarEventUpdateOptions,
  CalendarRepository,
} from '@/calendar/types';

type CalendarSource = 'demo' | 'device' | 'google';
type ConnectionStatus = 'checking' | 'connected' | 'demo' | 'error' | 'requesting';

type CalendarContextValue = {
  calendarAccountLabel?: string;
  calendarCount: number;
  calendarPermission: DeviceCalendarPermissionStatus;
  connectDeviceCalendar: () => Promise<void>;
  connectGoogleCalendar: () => Promise<void>;
  connectionStatus: ConnectionStatus;
  createEvent: (event: CalendarEventDraft) => Promise<CalendarEvent>;
  disconnectGoogleCalendar: () => Promise<void>;
  events: CalendarEvent[];
  getEvent: (id?: string) => CalendarEvent | undefined;
  isDeviceCalendarAvailable: boolean;
  isGoogleCalendarAvailable: boolean;
  isGoogleCalendarConfigured: boolean;
  isLoading: boolean;
  openEvent: (eventId: string) => Promise<boolean>;
  permissionCanAskAgain: boolean;
  refresh: () => Promise<void>;
  removeEvent: (eventId: string, calendarId?: string) => Promise<void>;
  source: CalendarSource;
  syncError?: string;
  updateEvent: (
    eventId: string,
    changes: Partial<CalendarEventDraft>,
    calendarId?: string,
    options?: CalendarEventUpdateOptions,
  ) => Promise<CalendarEvent>;
  useDemoCalendar: () => void;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);
const demoRepository = new DemoCalendarRepository();

function normalizedRouteId(value?: string) {
  if (!value) return value;
  let normalized = value;
  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
    } catch {
      break;
    }
  }
  return normalized;
}

export function CalendarProvider({ children }: PropsWithChildren) {
  const [calendarAccountLabel, setCalendarAccountLabel] = useState<string>();
  const [calendarCount, setCalendarCount] = useState(0);
  const [calendarPermission, setCalendarPermission] =
    useState<DeviceCalendarPermissionStatus>(
      deviceCalendar.isAvailable ? 'undetermined' : 'unavailable',
    );
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    deviceCalendar.isAvailable ? 'checking' : 'demo',
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionCanAskAgain, setPermissionCanAskAgain] = useState(true);
  const [repository, setRepository] = useState<CalendarRepository>(demoRepository);
  const [source, setSource] = useState<CalendarSource>('demo');
  const [syncError, setSyncError] = useState<string>();

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setSyncError(undefined);
    try {
      setEvents(await repository.listDay(new Date()));
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Calendar sync failed');
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  const activateDeviceCalendar = useCallback(async () => {
    setIsLoading(true);
    setSyncError(undefined);
    try {
      const connection = await deviceCalendar.connect();
      const nextEvents = await connection.repository.listDay(new Date());
      setCalendarAccountLabel(connection.accountLabel);
      setCalendarCount(connection.calendarCount);
      setEvents(nextEvents);
      setRepository(connection.repository);
      setSource('device');
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('error');
      setSyncError(error instanceof Error ? error.message : 'Device calendar connection failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activateGoogleCalendar = useCallback(async () => {
    setIsLoading(true);
    setSyncError(undefined);
    try {
      const connection = await googleCalendar.connect();
      const nextEvents = await connection.repository.listDay(new Date());
      setCalendarAccountLabel(connection.accountLabel);
      setCalendarCount(connection.calendarCount);
      setEvents(nextEvents);
      setRepository(connection.repository);
      setSource('google');
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('error');
      setSyncError(error instanceof Error ? error.message : 'Google Calendar connection failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const loadDemo = async () => {
      try {
        const nextEvents = await demoRepository.listDay(new Date());
        if (isCurrent) setEvents(nextEvents);
      } catch (error) {
        if (isCurrent) {
          setSyncError(error instanceof Error ? error.message : 'Demo calendar failed');
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    if (!deviceCalendar.isAvailable) {
      void googleCalendar.prepare().catch(() => undefined);
      void loadDemo();
      return () => {
        isCurrent = false;
      };
    }

    deviceCalendar
      .getPermission()
      .then(async (permission) => {
        if (!isCurrent) return;
        setCalendarPermission(permission.status);
        setPermissionCanAskAgain(permission.canAskAgain);
        if (permission.status === 'granted') {
          await activateDeviceCalendar();
        } else {
          setConnectionStatus('demo');
          await loadDemo();
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setConnectionStatus('error');
        setSyncError(error instanceof Error ? error.message : 'Calendar permission check failed');
        void loadDemo();
      });

    return () => {
      isCurrent = false;
    };
  }, [activateDeviceCalendar]);

  const connectDeviceCalendar = useCallback(async () => {
    setConnectionStatus('requesting');
    setSyncError(undefined);
    const permission = await deviceCalendar.requestPermission();
    setCalendarPermission(permission.status);
    setPermissionCanAskAgain(permission.canAskAgain);
    if (permission.status !== 'granted') {
      setConnectionStatus('error');
      throw new Error('Calendar permission was not granted');
    }
    await activateDeviceCalendar();
  }, [activateDeviceCalendar]);

  const connectGoogleCalendar = useCallback(async () => {
    setConnectionStatus('requesting');
    setSyncError(undefined);
    await activateGoogleCalendar();
  }, [activateGoogleCalendar]);

  const switchToDemoCalendar = useCallback(() => {
    setCalendarAccountLabel(undefined);
    setCalendarCount(0);
    setRepository(demoRepository);
    setSource('demo');
    setConnectionStatus('demo');
    setSyncError(undefined);
    void demoRepository.listDay(new Date()).then(setEvents);
  }, []);

  const disconnectGoogleCalendar = useCallback(async () => {
    await googleCalendar.disconnect();
    switchToDemoCalendar();
  }, [switchToDemoCalendar]);

  const value = useMemo<CalendarContextValue>(
    () => ({
      calendarAccountLabel,
      calendarCount,
      calendarPermission,
      connectDeviceCalendar,
      connectGoogleCalendar,
      connectionStatus,
      createEvent: async (event) => {
        const created = await repository.create(event);
        await refresh();
        return created;
      },
      disconnectGoogleCalendar,
      events,
      getEvent: (id) =>
        events.find((event) => normalizedRouteId(event.id) === normalizedRouteId(id)),
      isDeviceCalendarAvailable: deviceCalendar.isAvailable,
      isGoogleCalendarAvailable: googleCalendar.isAvailable,
      isGoogleCalendarConfigured: googleCalendar.isConfigured,
      isLoading,
      openEvent: async (eventId) => {
        if (!repository.open) return false;
        await repository.open(eventId);
        return true;
      },
      permissionCanAskAgain,
      refresh,
      removeEvent: async (eventId, calendarId) => {
        await repository.remove(eventId, calendarId);
        await refresh();
      },
      source,
      syncError,
      updateEvent: async (eventId, changes, calendarId, options) => {
        const updated = await repository.update(eventId, changes, calendarId, options);
        await refresh();
        return updated;
      },
      useDemoCalendar: switchToDemoCalendar,
    }),
    [
      calendarAccountLabel,
      calendarCount,
      calendarPermission,
      connectDeviceCalendar,
      connectGoogleCalendar,
      connectionStatus,
      disconnectGoogleCalendar,
      events,
      isLoading,
      permissionCanAskAgain,
      refresh,
      repository,
      source,
      syncError,
      switchToDemoCalendar,
    ],
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar() {
  const value = useContext(CalendarContext);
  if (!value) {
    throw new Error('useCalendar must be used inside CalendarProvider');
  }
  return value;
}
