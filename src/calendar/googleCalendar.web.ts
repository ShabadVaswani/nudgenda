import type {
  GoogleCalendarBridge,
  GoogleCalendarConnection,
} from '@/calendar/googleCalendar.types';
import { googleCalendarScopes } from '@/calendar/googleCalendar.types';
import type {
  CalendarDateTime,
  CalendarEvent,
  CalendarEventDraft,
  CalendarReminder,
  CalendarRepository,
} from '@/calendar/types';

const GOOGLE_API_ROOT = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
const GOOGLE_IDENTITY_SCRIPT_ID = 'nudgenda-google-identity';
const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
};

type GoogleTokenClient = {
  requestAccessToken(options?: { prompt?: string }): void;
};

type GoogleOAuth2 = {
  initTokenClient(config: {
    callback: (response: GoogleTokenResponse) => void;
    client_id: string;
    error_callback?: (error: { message?: string; type?: string }) => void;
    include_granted_scopes: boolean;
    scope: string;
  }): GoogleTokenClient;
  revoke(token: string, callback?: () => void): void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GoogleOAuth2;
      };
    };
  }
}

type GoogleCalendarListEntry = {
  accessRole?: 'freeBusyReader' | 'owner' | 'reader' | 'writer';
  backgroundColor?: string;
  id: string;
  primary?: boolean;
  selected?: boolean;
  summary?: string;
};

type GoogleEventResource = {
  colorId?: string;
  description?: string;
  end: CalendarDateTime;
  htmlLink?: string;
  id: string;
  location?: string;
  reminders?: {
    overrides?: { method: string; minutes: number }[];
    useDefault?: boolean;
  };
  start: CalendarDateTime;
  status?: string;
  summary?: string;
};

type GoogleListResponse<T> = {
  items?: T[];
  nextPageToken?: string;
};

type GoogleApiError = {
  error?: {
    message?: string;
  };
};

let accessToken = '';
let accessTokenExpiresAt = 0;
let identityScriptPromise: Promise<void> | undefined;

function loadGoogleIdentity() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google sign-in requires a browser'));
  }
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (identityScriptPromise) return identityScriptPromise;

  identityScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    const onLoad = () => resolve();
    const onError = () => reject(new Error('Could not load Google sign-in'));

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) {
      script.id = GOOGLE_IDENTITY_SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.src = GOOGLE_IDENTITY_SCRIPT;
      document.head.appendChild(script);
    }
  });

  return identityScriptPromise;
}

function clearToken() {
  accessToken = '';
  accessTokenExpiresAt = 0;
}

async function requestAccessToken() {
  if (!CLIENT_ID) {
    throw new Error('Google Calendar client ID is missing from the local environment');
  }

  await loadGoogleIdentity();
  const oauth2 = window.google?.accounts.oauth2;
  if (!oauth2) throw new Error('Google sign-in did not initialize');

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(popupTimeout);
      callback();
    };
    const popupTimeout = setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            'Your browser blocked Google sign-in. Allow popups for this site, then tap “Sign in with Google” again.',
          ),
        ),
      );
    }, 6000);
    const client = oauth2.initTokenClient({
      callback: (response) => {
        if (response.error || !response.access_token) {
          finish(() =>
            reject(
              new Error(
                response.error_description ??
                  response.error ??
                  'Google authorization was cancelled',
              ),
            ),
          );
          return;
        }
        accessToken = response.access_token;
        accessTokenExpiresAt = Date.now() + (response.expires_in ?? 3600) * 1000;
        finish(() => resolve(accessToken));
      },
      client_id: CLIENT_ID,
      error_callback: (error) => {
        finish(() =>
          reject(new Error(error.message ?? error.type ?? 'Google authorization failed')),
        );
      },
      include_granted_scopes: true,
      scope: googleCalendarScopes.join(' '),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

function currentToken() {
  if (!accessToken || Date.now() >= accessTokenExpiresAt - 30_000) {
    clearToken();
    throw new Error('Google Calendar access expired. Connect again to continue.');
  }
  return accessToken;
}

async function requestGoogle<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${currentToken()}`);
  if (options.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${GOOGLE_API_ROOT}${path}`, { ...options, headers });
  if (response.status === 401) clearToken();
  if (!response.ok) {
    let message = `Google Calendar request failed (${response.status})`;
    try {
      const payload = (await response.json()) as GoogleApiError;
      message = payload.error?.message ?? message;
    } catch {
      // Keep the status-based message when Google did not return JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function isWritable(calendar: GoogleCalendarListEntry) {
  return calendar.accessRole === 'owner' || calendar.accessRole === 'writer';
}

function localEventId(calendarId: string, eventId: string) {
  return `${encodeURIComponent(calendarId)}::${eventId}`;
}

function parseLocalEventId(value: string) {
  const separator = value.indexOf('::');
  if (separator < 0) return undefined;
  try {
    return {
      calendarId: decodeURIComponent(value.slice(0, separator)),
      eventId: value.slice(separator + 2),
    };
  } catch {
    return undefined;
  }
}

function mapReminder(reminder: { method: string; minutes: number }): CalendarReminder | undefined {
  if (reminder.method !== 'email' && reminder.method !== 'popup') return undefined;
  return { method: reminder.method, minutes: reminder.minutes };
}

function mapEvent(
  event: GoogleEventResource,
  calendar: GoogleCalendarListEntry,
): CalendarEvent {
  const overrides = event.reminders?.overrides
    ?.map(mapReminder)
    .filter((reminder): reminder is CalendarReminder => !!reminder);

  return {
    calendarColor: calendar.backgroundColor,
    calendarId: calendar.id,
    calendarName: calendar.summary,
    colorId: event.colorId,
    description: event.description,
    end: event.end,
    htmlLink: event.htmlLink,
    id: localEventId(calendar.id, event.id),
    location: event.location,
    reminders: {
      overrides,
      useDefault: event.reminders?.useDefault ?? true,
    },
    start: event.start,
    summary: event.summary ?? '(untitled event)',
  };
}

function eventBody(event: Partial<CalendarEventDraft>) {
  return {
    ...(event.summary !== undefined && { summary: event.summary }),
    ...(event.description !== undefined && { description: event.description }),
    ...(event.location !== undefined && { location: event.location }),
    ...(event.colorId !== undefined && { colorId: event.colorId }),
    ...(event.start !== undefined && { start: event.start }),
    ...(event.end !== undefined && { end: event.end }),
    ...(event.reminders !== undefined && { reminders: event.reminders }),
  };
}

async function listCalendars() {
  const calendars: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({ maxResults: '250', showHidden: 'false' });
    if (pageToken) query.set('pageToken', pageToken);
    const page = await requestGoogle<GoogleListResponse<GoogleCalendarListEntry>>(
      `/users/me/calendarList?${query}`,
    );
    calendars.push(...(page.items ?? []).filter((calendar) => calendar.selected !== false));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return calendars;
}

class GoogleCalendarRepository implements CalendarRepository {
  private eventLinks = new Map<string, string>();

  constructor(private calendars: GoogleCalendarListEntry[]) {}

  private writableCalendar(requestedId?: string) {
    const writable = this.calendars.filter(isWritable);
    const requested = writable.find((calendar) => calendar.id === requestedId);
    const selected = requested ?? writable.find((calendar) => calendar.primary) ?? writable[0];
    if (!selected) throw new Error('No writable Google calendar was found');
    return selected;
  }

  private eventTarget(eventId: string, calendarId?: string) {
    const parsed = parseLocalEventId(eventId);
    return {
      calendarId: parsed?.calendarId ?? calendarId ?? this.writableCalendar().id,
      eventId: parsed?.eventId ?? eventId,
    };
  }

  private async listCalendarDay(calendar: GoogleCalendarListEntry, day: Date) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const events: GoogleEventResource[] = [];
    let pageToken: string | undefined;

    do {
      const query = new URLSearchParams({
        maxResults: '2500',
        orderBy: 'startTime',
        showDeleted: 'false',
        singleEvents: 'true',
        timeMax: end.toISOString(),
        timeMin: start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (pageToken) query.set('pageToken', pageToken);
      const page = await requestGoogle<GoogleListResponse<GoogleEventResource>>(
        `/calendars/${encodeURIComponent(calendar.id)}/events?${query}`,
      );
      events.push(...(page.items ?? []).filter((event) => event.status !== 'cancelled'));
      pageToken = page.nextPageToken;
    } while (pageToken);

    return events.map((event) => {
      const mapped = mapEvent(event, calendar);
      if (mapped.htmlLink) this.eventLinks.set(mapped.id, mapped.htmlLink);
      return mapped;
    });
  }

  async listDay(day: Date, calendarId?: string) {
    const calendars = calendarId
      ? this.calendars.filter((calendar) => calendar.id === calendarId)
      : this.calendars;
    const events = (await Promise.all(calendars.map((calendar) => this.listCalendarDay(calendar, day))))
      .flat();
    return events.sort((left, right) => {
      const leftStart = new Date(left.start.dateTime ?? left.start.date ?? 0).getTime();
      const rightStart = new Date(right.start.dateTime ?? right.start.date ?? 0).getTime();
      return leftStart - rightStart;
    });
  }

  async create(event: CalendarEventDraft) {
    const calendar = this.writableCalendar(event.calendarId);
    const created = await requestGoogle<GoogleEventResource>(
      `/calendars/${encodeURIComponent(calendar.id)}/events`,
      { body: JSON.stringify(eventBody(event)), method: 'POST' },
    );
    const mapped = mapEvent(created, calendar);
    if (mapped.htmlLink) this.eventLinks.set(mapped.id, mapped.htmlLink);
    return mapped;
  }

  async update(
    eventId: string,
    changes: Partial<CalendarEventDraft>,
    calendarId?: string,
  ) {
    const target = this.eventTarget(eventId, calendarId);
    const calendar = this.calendars.find((item) => item.id === target.calendarId);
    if (!calendar) throw new Error('The event calendar is no longer available');
    const updated = await requestGoogle<GoogleEventResource>(
      `/calendars/${encodeURIComponent(target.calendarId)}/events/${encodeURIComponent(target.eventId)}`,
      { body: JSON.stringify(eventBody(changes)), method: 'PATCH' },
    );
    const mapped = mapEvent(updated, calendar);
    if (mapped.htmlLink) this.eventLinks.set(mapped.id, mapped.htmlLink);
    return mapped;
  }

  async remove(eventId: string, calendarId?: string) {
    const target = this.eventTarget(eventId, calendarId);
    await requestGoogle<void>(
      `/calendars/${encodeURIComponent(target.calendarId)}/events/${encodeURIComponent(target.eventId)}`,
      { method: 'DELETE' },
    );
    this.eventLinks.delete(eventId);
  }

  async open(eventId: string) {
    const link = this.eventLinks.get(eventId);
    if (!link) throw new Error('Google Calendar link is unavailable for this event');
    window.open(link, '_blank', 'noopener,noreferrer');
  }
}

async function connect(): Promise<GoogleCalendarConnection> {
  await requestAccessToken();
  const calendars = await listCalendars();
  if (!calendars.length) throw new Error('No Google calendars were returned for this account');
  const primary = calendars.find((calendar) => calendar.primary) ?? calendars[0];
  return {
    accountLabel: primary.id,
    calendarCount: calendars.length,
    repository: new GoogleCalendarRepository(calendars),
  };
}

export const googleCalendar: GoogleCalendarBridge = {
  isAvailable: true,
  isConfigured: Boolean(CLIENT_ID),
  connect,
  async disconnect() {
    const token = accessToken;
    clearToken();
    const oauth2 = window.google?.accounts.oauth2;
    if (!token || !oauth2) return;
    await new Promise<void>((resolve) => oauth2.revoke(token, resolve));
  },
  async prepare() {
    if (!CLIENT_ID) return;
    await loadGoogleIdentity();
  },
};
