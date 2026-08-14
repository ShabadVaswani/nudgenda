import type { CalendarEvent } from '@/calendar/types';
import { requestOpenRouterJson } from '@/agent/openRouterRequest';
import { formatAgentLocalTime } from '@/agent/timeContext';

export type AgentConversationMessage = {
  content: string;
  role: 'assistant' | 'user';
};

export type CalendarAgentAction = {
  description: string | null;
  end: string | null;
  eventId: string | null;
  start: string | null;
  title: string | null;
  type: 'create' | 'delete' | 'update';
};

export type CalendarAgentTurn = {
  actions: CalendarAgentAction[];
  reply: string;
};

type OpenRouterResponse = {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
  error?: {
    message?: string;
  };
};

function eventContext(event: CalendarEvent) {
  return {
    calendar: event.calendarName ?? event.calendarId,
    description: event.description ?? '',
    end: event.end.dateTime ?? event.end.date,
    id: event.id,
    start: event.start.dateTime ?? event.start.date,
    title: event.summary,
  };
}

function systemPrompt(events: CalendarEvent[], memoryContext: string) {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDateTime = formatAgentLocalTime(now, timezone);
  return `You are Nudgenda, a decisive personal calendar agent.
Current local date and time: ${localDateTime}
User timezone: ${timezone}
Current UTC instant (reference only): ${now.toISOString()}

Behavior:
- Use the supplied calendar state as the source of truth.
- If the user asks to schedule, move, shorten, rename, or delete something, return the required actions immediately. Do not ask for confirmation unless essential information is truly missing.
- If the user explicitly says this is only planning, a draft, or not to add it yet, return no actions.
- For a vague request to plan time, plan the next few useful hours. Only plan the whole day when the user asks for it.
- Do not overlap events unless the user explicitly requests it.
- Never create two mutually exclusive alternatives (for example, two possible sleep times). Infer one reasonable choice from context; ask only if the choice is essential and genuinely ambiguous.
- Preserve existing event IDs for updates and deletes.
- Use concise, friendly replies. Never claim an action succeeded; say what you are going to do. The app reports what actually succeeded.
- Dates in actions must be ISO 8601 strings with an explicit offset. For create actions, title, start, and end are required. For updates, eventId is required and only changed fields should be non-null. For deletes, eventId is required.
- Return only one JSON object with this exact shape and no markdown fences:
  {"reply":"short user-facing reply","actions":[{"type":"create|update|delete","eventId":null,"title":null,"start":null,"end":null,"description":null}]}
- Every action must contain all six action fields. Use null for fields that do not apply.

Calendar events for today and the upcoming week JSON:
${JSON.stringify(events.map(eventContext))}

${memoryContext}`;
}

function parseTurn(content?: string): CalendarAgentTurn {
  if (!content) throw new Error('The model returned an empty response');
  try {
    const withoutFence = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const firstBrace = withoutFence.indexOf('{');
    const lastBrace = withoutFence.lastIndexOf('}');
    const candidate =
      firstBrace >= 0 && lastBrace > firstBrace
        ? withoutFence.slice(firstBrace, lastBrace + 1)
        : withoutFence;
    const parsed = JSON.parse(candidate) as CalendarAgentTurn;
    if (!parsed.reply || !Array.isArray(parsed.actions)) throw new Error('Missing response fields');
    if (parsed.actions.some((action) => !['create', 'delete', 'update'].includes(action.type))) {
      throw new Error('Invalid action');
    }
    return parsed;
  } catch {
    throw new Error('The model returned an unreadable calendar response. Try again.');
  }
}

export async function requestCalendarAgentTurn(options: {
  apiKey: string;
  events: CalendarEvent[];
  memoryContext: string;
  messages: AgentConversationMessage[];
  model: string;
}) {
  const { payload } = await requestOpenRouterJson<OpenRouterResponse>({
    apiKey: options.apiKey,
    body: {
      messages: [
        { content: systemPrompt(options.events, options.memoryContext), role: 'system' },
        ...options.messages.slice(-10),
      ],
      model: options.model,
      stream: false,
      temperature: 0.25,
    },
    title: 'Nudgenda',
    validate: (responsePayload) => {
      try {
        parseTurn(responsePayload.choices?.[0]?.message?.content);
        return true;
      } catch {
        return false;
      }
    },
  });
  return parseTurn(payload.choices?.[0]?.message?.content);
}
