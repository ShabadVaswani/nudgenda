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
import type {
  CalendarEvent,
  CalendarEventDraft,
  CalendarRepository,
} from '@/calendar/types';

type CalendarSource = 'demo' | 'device';
type ConnectionStatus = 'checking' | 'connected' | 'demo' | 'error' | 'requesting';

type CalendarContextValue = {
  calendarAccountLabel?: string;
  calendarCount: number;
  calendarPermission: DeviceCalendarPermissionStatus;
  connectDeviceCalendar: () => Promise<void>;
  connectionStatus: ConnectionStatus;
  createEvent: (event: CalendarEventDraft) => Promise<CalendarEvent>;
  events: CalendarEvent[];
  getEvent: (id?: string) => CalendarEvent | undefined;
  isDeviceCalendarAvailable: boolean;
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
  ) => Promise<CalendarEvent>;
  useDemoCalendar: () => void;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);
const demoRepository = new DemoCalendarRepository();

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

  const useDemoCalendar = useCallback(() => {
    setCalendarAccountLabel(undefined);
    setCalendarCount(0);
    setRepository(demoRepository);
    setSource('demo');
    setConnectionStatus('demo');
    setSyncError(undefined);
  }, []);

  const value = useMemo<CalendarContextValue>(
    () => ({
      calendarAccountLabel,
      calendarCount,
      calendarPermission,
      connectDeviceCalendar,
      connectionStatus,
      createEvent: async (event) => {
        const created = await repository.create(event);
        await refresh();
        return created;
      },
      events,
      getEvent: (id) => events.find((event) => event.id === id),
      isDeviceCalendarAvailable: deviceCalendar.isAvailable,
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
      updateEvent: async (eventId, changes, calendarId) => {
        const updated = await repository.update(eventId, changes, calendarId);
        await refresh();
        return updated;
      },
      useDemoCalendar,
    }),
    [
      calendarAccountLabel,
      calendarCount,
      calendarPermission,
      connectDeviceCalendar,
      connectionStatus,
      events,
      isLoading,
      permissionCanAskAgain,
      refresh,
      repository,
      source,
      syncError,
      useDemoCalendar,
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
