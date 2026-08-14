import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_OPENROUTER_MODEL,
  useAgentSettings,
} from '@/agent/AgentSettingsProvider';
import { useCalendar } from '@/calendar/CalendarProvider';
import { NeoCard } from '@/components/NeoCard';
import { OutlinedTitle } from '@/components/OutlinedTitle';
import { colors, fonts, spacing } from '@/constants/design';
import { useMemory } from '@/memory/MemoryProvider';

const FREE_MODEL_OPTIONS = [
  { id: 'openrouter/free', label: 'Auto', recommended: true },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super', recommended: false },
  { id: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B', recommended: false },
  { id: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B', recommended: false },
  { id: 'liquid/lfm-2.5-2.6b:free', label: 'LFM 2.5', recommended: false },
] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const { apiKey, clearApiKey, isConfigured, model, save } = useAgentSettings();
  const {
    clear: clearMemory,
    runMaintenance,
    state: memory,
    status: memoryStatus,
  } = useMemory();
  const {
    calendarAccountLabel,
    connectDeviceCalendar,
    disconnectGoogleCalendar,
    isDeviceCalendarAvailable,
    isGoogleCalendarAvailable,
    refresh,
    source,
    useDemoCalendar: switchToDemoCalendar,
  } = useCalendar();
  const [draft, setDraft] = useState<{ apiKey: string; model: string }>();
  const [saved, setSaved] = useState(false);
  const draftKey = draft?.apiKey ?? apiKey;
  const draftModel = draft?.model ?? model;

  const saveOpenRouter = async () => {
    await save(draftKey, draftModel);
    setDraft(undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const signOutCalendar = async () => {
    if (source === 'google') await disconnectGoogleCalendar();
    else switchToDemoCalendar();
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" hitSlop={12} onPress={() => router.replace('/')}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <OutlinedTitle style={styles.title}>SETTINGS</OutlinedTitle>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <NeoCard backgroundColor={colors.periwinkle} style={styles.card}>
            <Text style={styles.eyebrow}>CALENDAR ACCOUNT</Text>
            <Text style={styles.cardTitle}>
              {source === 'google'
                ? calendarAccountLabel ?? 'Google Calendar connected'
                : source === 'device'
                  ? calendarAccountLabel ?? 'Android calendar connected'
                  : 'not signed in'}
            </Text>
            <Text style={styles.body}>
              {source === 'google'
                ? 'Nudgenda is using temporary browser permission for Google Calendar.'
                : source === 'device'
                  ? 'Nudgenda reads the calendars already synced to this Android device.'
                  : 'Sign in to use your real schedule instead of the demo calendar.'}
            </Text>

            {source === 'demo' && (isGoogleCalendarAvailable || isDeviceCalendarAvailable) && (
              <Pressable
                onPress={() =>
                  isGoogleCalendarAvailable
                    ? router.push('/connect/google')
                    : void connectDeviceCalendar()
                }
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>
                  {isGoogleCalendarAvailable ? 'sign in to Google' : 'connect Android calendar'}
                </Text>
              </Pressable>
            )}
            {source !== 'demo' && (
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => void refresh()}
                  style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}>
                  <Text style={styles.smallButtonText}>refresh</Text>
                </Pressable>
                <Pressable
                  onPress={() => void signOutCalendar()}
                  style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}>
                  <Text style={styles.smallButtonText}>
                    {source === 'google' ? 'sign out' : 'disconnect'}
                  </Text>
                </Pressable>
              </View>
            )}
          </NeoCard>

          <NeoCard backgroundColor={colors.aqua} style={styles.card}>
            <Text style={styles.eyebrow}>OPENROUTER</Text>
            <Text style={styles.cardTitle}>
              {isConfigured ? 'calendar agent enabled' : 'add your own API key'}
            </Text>
            <Text style={styles.fieldLabel}>API key</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => setDraft({ apiKey: value, model: draftModel })}
              placeholder="sk-or-v1-…"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
              value={draftKey}
            />
            <Text style={styles.fieldLabel}>Model</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => setDraft({ apiKey: draftKey, model: value })}
              placeholder={DEFAULT_OPENROUTER_MODEL}
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={draftModel}
            />
            <Text style={styles.recommendedHeading}>RECOMMENDED FREE MODELS</Text>
            <View style={styles.modelOptions}>
              {FREE_MODEL_OPTIONS.map((option) => {
                const selected = draftModel === option.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.id}
                    onPress={() => setDraft({ apiKey: draftKey, model: option.id })}
                    style={({ pressed }) => [
                      styles.modelButton,
                      selected && styles.modelButtonSelected,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.modelButtonLabel}>{option.label}</Text>
                    <Text style={styles.modelButtonMeta}>
                      {option.recommended ? 'recommended · free' : 'free'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.body}>
              {Platform.OS === 'web'
                ? 'The key stays in this browser’s local storage and is sent directly to OpenRouter.'
                : 'The key is stored in Android secure storage and is sent directly to OpenRouter.'}{' '}
              The default openrouter/free route uses currently available free models.
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => void saveOpenRouter()}
                style={({ pressed }) => [styles.primaryButton, styles.flexButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>{saved ? 'saved ✓' : 'save key'}</Text>
              </Pressable>
              {isConfigured && (
                <Pressable
                  onPress={() => {
                    setDraft(undefined);
                    void clearApiKey();
                  }}
                  style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}>
                  <Text style={styles.smallButtonText}>remove key</Text>
                </Pressable>
              )}
            </View>
          </NeoCard>

          <NeoCard backgroundColor={colors.lime} style={styles.card}>
            <Text style={styles.eyebrow}>AGENT MEMORY</Text>
            <Text style={styles.cardTitle}>
              {memory.messages.length || memory.sources.length
                ? `${memory.messages.length} messages · ${memory.sources.length} imports`
                : 'start a context notebook'}
            </Text>
            <Text style={styles.body}>
              DeepSeek compacts older chat after 30 messages and consolidates the notebook after 9 PM
              or the next time the app opens. Original messages remain stored locally.
            </Text>
            {!!memory.notebook.trim() && (
              <Text numberOfLines={9} style={styles.memoryPreview}>{memory.notebook}</Text>
            )}
            <Pressable
              onPress={() => router.push('/settings/import-context')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>
                {memory.sources.length ? 'inspect or import context' : 'import context'}
              </Text>
            </Pressable>
            <View style={styles.buttonRow}>
              <Pressable
                disabled={!isConfigured || memoryStatus !== 'idle' || !memory.messages.length}
                onPress={() => void runMaintenance(true)}
                style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}>
                <Text style={styles.smallButtonText}>
                  {memoryStatus === 'idle' ? 'consolidate now' : 'updating…'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void clearMemory()}
                style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}>
                <Text style={styles.smallButtonText}>clear memory</Text>
              </Pressable>
            </View>
          </NeoCard>

          <Text style={styles.footnote}>
            Nudgenda has no backend. Calendar data and keys stay between this device, Google, and
            OpenRouter.
          </Text>
          {!isDeviceCalendarAvailable && !isGoogleCalendarAvailable && (
            <Text style={styles.footnote}>Calendar connection is unavailable on this platform.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.paper,
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
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  backIcon: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 42,
  },
  title: {
    flex: 1,
    fontSize: 37,
    letterSpacing: -1,
    lineHeight: 43,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 13,
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 25,
  },
  body: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 16,
    lineHeight: 22,
  },
  fieldLabel: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 17,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  recommendedHeading: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  modelOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modelButton: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    flexBasis: '46%',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  modelButtonSelected: {
    backgroundColor: colors.lime,
    shadowColor: colors.ink,
    shadowOffset: { height: 3, width: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  modelButtonLabel: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 15,
  },
  memoryPreview: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 9,
    borderWidth: 2,
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 14,
    lineHeight: 19,
    padding: spacing.sm,
  },
  modelButtonMeta: {
    color: colors.muted,
    fontFamily: fonts.hand,
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  flexButton: {
    flex: 1,
  },
  primaryButtonText: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 18,
  },
  smallButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: colors.pink,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  smallButtonText: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ translateY: 1 }],
  },
  footnote: {
    color: colors.muted,
    fontFamily: fonts.hand,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
});
