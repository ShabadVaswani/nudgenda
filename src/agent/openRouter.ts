import type { CalendarEvent } from '@/calendar/types';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

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

const responseSchema = {
  name: 'nudgenda_calendar_turn',
  schema: {
    additionalProperties: false,
    properties: {
      actions: {
        items: {
          additionalProperties: false,
          properties: {
            description: { type: ['string', 'null'] },
            end: {
              description: 'ISO 8601 date-time with an explicit UTC offset, or null',
              type: ['string', 'null'],
            },
            eventId: { type: ['string', 'null'] },
            start: {
              description: 'ISO 8601 date-time with an explicit UTC offset, or null',
              type: ['string', 'null'],
            },
            title: { type: ['string', 'null'] },
            type: { enum: ['create', 'update', 'delete'], type: 'string' },
          },
          required: ['type', 'eventId', 'title', 'start', 'end', 'description'],
          type: 'object',
        },
        type: 'array',
      },
      reply: { type: 'string' },
    },
    required: ['reply', 'actions'],
    type: 'object',
  },
  strict: true,
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
  return `You are Nudgenda, a decisive personal calendar agent.
Current local date and time: ${now.toISOString()}
User timezone: ${timezone}

Behavior:
- Use the supplied calendar state as the source of truth.
- If the user asks to schedule, move, shorten, rename, or delete something, return the required actions immediately. Do not ask for confirmation unless essential information is truly missing.
- If the user explicitly says this is only planning, a draft, or not to add it yet, return no actions.
- For a vague request to plan time, plan the next few useful hours. Only plan the whole day when the user asks for it.
- Do not overlap events unless the user explicitly requests it.
- Preserve existing event IDs for updates and deletes.
- Use concise, friendly replies. Never claim an action succeeded; say what you are going to do. The app reports what actually succeeded.
- Dates in actions must be ISO 8601 strings with an explicit offset. For create actions, title, start, and end are required. For updates, eventId is required and only changed fields should be non-null. For deletes, eventId is required.

Today's calendar JSON:
${JSON.stringify(events.map(eventContext))}

${memoryContext}`;
}

function parseTurn(content?: string): CalendarAgentTurn {
  if (!content) throw new Error('The model returned an empty response');
  try {
    const parsed = JSON.parse(content) as CalendarAgentTurn;
    if (!parsed.reply || !Array.isArray(parsed.actions)) throw new Error('Missing response fields');
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
  const response = await fetch(OPENROUTER_ENDPOINT, {
    body: JSON.stringify({
      messages: [
        { content: systemPrompt(options.events, options.memoryContext), role: 'system' },
        ...options.messages.slice(-10),
      ],
      model: options.model,
      provider: { require_parameters: true },
      response_format: { json_schema: responseSchema, type: 'json_schema' },
      stream: false,
      temperature: 0.25,
    }),
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/ShabadVaswani/nudgenda',
      'X-Title': 'Nudgenda',
    },
    method: 'POST',
  });

  let payload: OpenRouterResponse;
  try {
    payload = (await response.json()) as OpenRouterResponse;
  } catch {
    throw new Error(`OpenRouter returned an unreadable response (${response.status})`);
  }

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `OpenRouter request failed (${response.status})`);
  }
  return parseTurn(payload.choices?.[0]?.message?.content);
}
