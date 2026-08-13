import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAgentSettings } from '@/agent/AgentSettingsProvider';
import {
  type AgentConversationMessage,
  type CalendarAgentAction,
  requestCalendarAgentTurn,
} from '@/agent/openRouter';
import { useCalendar } from '@/calendar/CalendarProvider';
import type { CalendarEventDraft } from '@/calendar/types';
import { MicButton } from '@/components/MicButton';
import { NeoCard } from '@/components/NeoCard';
import { VoiceWave } from '@/components/VoiceWave';
import { colors, fonts, spacing } from '@/constants/design';
import { useImportedContext } from '@/context/ImportedContextProvider';
import { useVoiceInput } from '@/voice/useVoiceInput';

type ChatMessage = AgentConversationMessage & {
  id: string;
  time: string;
};

function timeLabel() {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(),
  );
}

function dateTime(value: string | null) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`The agent produced an invalid time: ${value}`);
  return {
    dateTime: parsed.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ listening?: string }>();
  const { apiKey, isConfigured, model } = useAgentSettings();
  const { context: importedContext } = useImportedContext();
  const { createEvent, events, removeEvent, updateEvent } = useCalendar();
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      content:
        'Hi! How do you want to get started? I can plan the next few hours, rearrange today, or add something to your calendar.',
      id: 'welcome',
      role: 'assistant',
      time: timeLabel(),
    },
  ]);
  const [error, setError] = useState<string>();
  const [entranceOffset] = useState(() => new Animated.Value(64));
  const hasAutoStartedVoice = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const speechBase = useRef('');
  const {
    error: speechError,
    isListening,
    start: startVoice,
    stop: stopVoice,
    transcript,
    volume: voiceVolume,
  } = useVoiceInput();

  useEffect(() => {
    Animated.spring(entranceOffset, {
      damping: 22,
      mass: 0.8,
      stiffness: 210,
      toValue: 0,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [entranceOffset]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [isSending, messages]);

  useEffect(() => {
    const keyboardEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const subscription = Keyboard.addListener(keyboardEvent, () => {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!transcript) return;
    const prefix = speechBase.current ? `${speechBase.current} ` : '';
    setMessage(`${prefix}${transcript}`);
  }, [transcript]);

  const beginListening = useCallback(async () => {
    speechBase.current = message.trim();
    setError(undefined);
    await startVoice({
      contextualStrings: [
        'Nudgenda',
        'Google Calendar',
        'schedule',
        'rearrange',
        ...events.map((event) => event.summary),
      ].slice(0, 50),
    });
  }, [events, message, startVoice]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  useEffect(() => {
    if (params.listening !== '1' || hasAutoStartedVoice.current) return;
    hasAutoStartedVoice.current = true;
    void beginListening();
  }, [beginListening, params.listening]);

  const applyAction = async (action: CalendarAgentAction) => {
    if (action.type === 'create') {
      if (!action.title || !action.start || !action.end) {
        throw new Error('The agent omitted information required to create an event');
      }
      const draft: CalendarEventDraft = {
        calendarId: events[0]?.calendarId ?? 'primary',
        description: action.description ?? undefined,
        end: dateTime(action.end)!,
        reminders: { useDefault: true },
        start: dateTime(action.start)!,
        summary: action.title,
      };
      await createEvent(draft);
      return `added ${action.title}`;
    }

    if (!action.eventId) throw new Error('The agent did not identify the event to change');
    const existing = events.find((event) => event.id === action.eventId);
    if (!existing) throw new Error('The event selected by the agent is no longer on today’s calendar');

    if (action.type === 'delete') {
      await removeEvent(existing.id, existing.calendarId);
      return `removed ${existing.summary}`;
    }

    const changes: Partial<CalendarEventDraft> = {};
    if (action.title) changes.summary = action.title;
    if (action.description !== null) changes.description = action.description;
    if (action.start) changes.start = dateTime(action.start);
    if (action.end) changes.end = dateTime(action.end);
    await updateEvent(existing.id, changes, existing.calendarId);
    return `updated ${action.title ?? existing.summary}`;
  };

  const send = async () => {
    const content = message.trim();
    if (!content || isSending) return;
    if (!isConfigured) {
      setError('Add your OpenRouter key in settings before chatting.');
      return;
    }

    const userMessage: ChatMessage = {
      content,
      id: `user-${Date.now()}`,
      role: 'user',
      time: timeLabel(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setMessage('');
    setError(undefined);
    setIsSending(true);

    try {
      const turn = await requestCalendarAgentTurn({
        apiKey,
        events,
        importedContext,
        messages: nextMessages.map(({ content: text, role }) => ({ content: text, role })),
        model,
      });
      const applied: string[] = [];
      for (const action of turn.actions) applied.push(await applyAction(action));
      const resultSuffix = applied.length ? `\n\n✓ ${applied.join('\n✓ ')}` : '';
      setMessages((current) => [
        ...current,
        {
          content: `${turn.reply}${resultSuffix}`,
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          time: timeLabel(),
        },
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The calendar agent failed');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}>
      <Animated.View
        style={[styles.animatedContent, { transform: [{ translateY: entranceOffset }] }]}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={goBack}
            style={styles.headerButton}>
            <Text style={styles.headerIcon}>←</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Open settings"
            hitSlop={12}
            onPress={() => router.push('/settings/calendar')}
            style={styles.headerButton}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.messages}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={styles.messageList}>
          {!isConfigured && (
            <Pressable onPress={() => router.push('/settings/calendar')}>
              <NeoCard backgroundColor={colors.yellow} style={styles.setupCard}>
                <Text style={styles.setupTitle}>add an OpenRouter key to start</Text>
                <Text style={styles.setupBody}>stored locally · free router selected by default →</Text>
              </NeoCard>
            </Pressable>
          )}

          {messages.map((item) => (
            <NeoCard
              backgroundColor={item.role === 'user' ? colors.lime : colors.periwinkle}
              key={item.id}
              style={item.role === 'user' ? styles.userBubble : styles.agentBubble}>
              <Text style={styles.meta}>
                {item.role === 'user' ? 'YOU' : 'AGENT'} · {item.time}
              </Text>
              <Text style={styles.message}>{item.content}</Text>
            </NeoCard>
          ))}

          {isSending && (
            <NeoCard backgroundColor={colors.periwinkle} style={styles.agentBubble}>
              <Text style={styles.meta}>AGENT · THINKING</Text>
              <Text style={styles.thinking}>•••</Text>
            </NeoCard>
          )}
        </ScrollView>

        {!!(error ?? speechError) && (
          <Text style={styles.error}>{error ?? speechError}</Text>
        )}
        {isListening && <VoiceWave level={voiceVolume} />}

        <View style={styles.composerArea}>
          <NeoCard style={styles.composer}>
            <TextInput
              accessibilityLabel="Message the calendar agent"
              editable={!isSending && !isListening}
              multiline
              onChangeText={setMessage}
              onSubmitEditing={() => void send()}
              placeholder="change something or plan my day…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={message}
            />
            {!!message.trim() && (
              <Pressable
                accessibilityLabel="Send message"
                onPress={() => void send()}
                style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
                <Text style={styles.sendIcon}>↑</Text>
              </Pressable>
            )}
            <MicButton
              active={isListening}
              compact
              onPress={() => {
                if (isListening) stopVoice();
                else void beginListening();
              }}
            />
          </NeoCard>
        </View>
        </SafeAreaView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.pinkPaper,
    flex: 1,
  },
  animatedContent: {
    flex: 1,
  },
  safeArea: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 820,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  headerButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  headerIcon: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 42,
    lineHeight: 44,
  },
  settingsIcon: {
    color: colors.ink,
    fontSize: 25,
  },
  messages: {
    flexGrow: 1,
    gap: spacing.lg,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  messageList: {
    flex: 1,
  },
  setupCard: {
    alignSelf: 'center',
    padding: spacing.md,
    width: '92%',
  },
  setupTitle: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 19,
  },
  setupBody: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 15,
    marginTop: 2,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    padding: spacing.md,
  },
  agentBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    padding: spacing.md,
  },
  meta: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 11,
  },
  message: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 20,
    lineHeight: 25,
    marginTop: 3,
  },
  thinking: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 25,
    letterSpacing: 4,
  },
  error: {
    color: '#8A2739',
    fontFamily: fonts.handBold,
    fontSize: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
  composerArea: {
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  composer: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 68,
    paddingLeft: spacing.md,
    paddingRight: 7,
    paddingVertical: 7,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.hand,
    fontSize: 17,
    lineHeight: 22,
    maxHeight: 90,
    paddingRight: spacing.sm,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: 20,
    borderWidth: 2,
    height: 38,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 38,
  },
  sendIcon: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 25,
    lineHeight: 27,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ translateY: 1 }],
  },
});
