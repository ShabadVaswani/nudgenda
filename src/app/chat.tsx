import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
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

import { MicButton } from '@/components/MicButton';
import { NeoCard } from '@/components/NeoCard';
import { OutlinedTitle } from '@/components/OutlinedTitle';
import { colors, fonts, spacing } from '@/constants/design';

const addedBlocks = [
  ['5:00–5:30 PM', 'workout', colors.lime],
  ['5:30–6:00 PM', 'shower', colors.pink],
  ['6:00–6:30 PM', 'dinner', colors.aqua],
  ['6:30–7:00 PM', 'plan tomorrow', colors.yellow],
] as const;

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ listening?: string }>();
  const [isListening, setIsListening] = useState(params.listening === '1');
  const [message, setMessage] = useState(
    params.listening === '1' ? 'move my workout to this evening' : '',
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <OutlinedTitle style={styles.title}>CHAT</OutlinedTitle>
          <Text style={styles.doodle}>{'///'}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <NeoCard backgroundColor={colors.lime} style={styles.userBubble}>
            <Text style={styles.meta}>YOU · 9:41 AM</Text>
            <Text style={styles.message}>plan my next four hours</Text>
          </NeoCard>

          <NeoCard backgroundColor={colors.periwinkle} style={styles.agentBubble}>
            <Text style={styles.meta}>AGENT · 9:41 AM</Text>
            <Text style={styles.message}>done — four blocks added</Text>
          </NeoCard>

          <NeoCard style={styles.addedCard}>
            <Text style={styles.addedHeading}>ADDED TO TODAY</Text>
            {addedBlocks.map(([time, title, color]) => (
              <View key={title} style={styles.addedRow}>
                <View style={[styles.swatch, { backgroundColor: color }]} />
                <Text style={styles.addedTime}>{time}</Text>
                <Text style={styles.addedTitle}>{title}</Text>
              </View>
            ))}
          </NeoCard>
        </ScrollView>

        <View style={styles.composerArea}>
          <NeoCard style={styles.composer}>
            <TextInput
              accessibilityLabel="Message the calendar agent"
              multiline
              onChangeText={setMessage}
              placeholder="change something or plan my day…"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={message}
            />
            <MicButton
              active={isListening}
              compact
              onPress={() => setIsListening((current) => !current)}
            />
          </NeoCard>
          {isListening && <Text style={styles.listeningHint}>tap mic to stop ↗</Text>}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.pinkPaper,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backIcon: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 42,
    lineHeight: 44,
  },
  title: {
    fontSize: 50,
    lineHeight: 54,
  },
  doodle: {
    fontFamily: fonts.handBold,
    fontSize: 24,
    transform: [{ rotate: '-18deg' }],
    width: 44,
  },
  messages: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
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
    lineHeight: 26,
    marginTop: 3,
  },
  addedCard: {
    alignSelf: 'center',
    padding: spacing.md,
    width: '92%',
  },
  addedHeading: {
    borderBottomColor: colors.ink,
    borderBottomWidth: 1.5,
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 22,
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
  },
  addedRow: {
    alignItems: 'center',
    borderBottomColor: colors.ink,
    borderStyle: 'dashed',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 38,
  },
  swatch: {
    borderColor: colors.ink,
    borderWidth: 1.5,
    height: 20,
    width: 20,
  },
  addedTime: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 14,
    width: 104,
  },
  addedTitle: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.hand,
    fontSize: 15,
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
  listeningHint: {
    alignSelf: 'flex-end',
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 13,
    marginRight: 4,
    marginTop: 7,
  },
});
