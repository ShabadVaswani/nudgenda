import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCalendar } from '@/calendar/CalendarProvider';
import { NeoCard } from '@/components/NeoCard';
import { OutlinedTitle } from '@/components/OutlinedTitle';
import { colors, fonts, spacing } from '@/constants/design';

export default function GoogleCalendarConnectScreen() {
  const router = useRouter();
  const {
    connectGoogleCalendar,
    connectionStatus,
    isGoogleCalendarAvailable,
    isGoogleCalendarConfigured,
    source,
  } = useCalendar();
  const [error, setError] = useState<string>();
  const isBusy = connectionStatus === 'requesting' || connectionStatus === 'checking';
  const canConnect =
    isGoogleCalendarAvailable && isGoogleCalendarConfigured && !isBusy && source !== 'google';

  const connect = async () => {
    setError(undefined);
    try {
      await connectGoogleCalendar();
      router.replace('/');
    } catch (connectionError) {
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : 'Google Calendar connection failed',
      );
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" hitSlop={12} onPress={() => router.replace('/')}>
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </Pressable>
          <OutlinedTitle style={styles.title}>{'SIGN IN\nGOOGLE'}</OutlinedTitle>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <NeoCard backgroundColor={colors.aqua} style={styles.heroCard}>
            <Text style={styles.eyebrow}>GOOGLE CALENDAR</Text>
            <Text style={styles.heroTitle}>sign in to bring your real day into Nudgenda</Text>
            <Text style={styles.body}>
              Google opens a secure account window. Nudgenda receives temporary permission to read
              your calendar list and manage events you authorize.
            </Text>
          </NeoCard>

          <NeoCard style={styles.permissionCard}>
            <Text style={styles.sectionTitle}>WHAT IT CAN DO</Text>
            <Text style={styles.allowed}>{'\u2713'} show today&apos;s real events</Text>
            <Text style={styles.allowed}>{'\u2713'} create and rearrange schedule blocks</Text>
            <Text style={styles.allowed}>{'\u2713'} update and delete calendar events</Text>
            <View style={styles.divider} />
            <Text style={styles.denied}>{'\u00d7'} no Gmail access</Text>
            <Text style={styles.denied}>{'\u00d7'} no Google password access</Text>
            <Text style={styles.denied}>{'\u00d7'} no Nudgenda backend</Text>
          </NeoCard>

          {!isGoogleCalendarConfigured && (
            <NeoCard backgroundColor={colors.pinkPaper} style={styles.warningCard}>
              <Text style={styles.warningTitle}>client ID missing</Text>
              <Text style={styles.body}>
                Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to the local environment and restart Expo.
              </Text>
            </NeoCard>
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            accessibilityRole="button"
            disabled={!canConnect}
            onPress={() => void connect()}
            style={({ pressed }) => [
              styles.connectButton,
              !canConnect && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.connectButtonText}>
              {source === 'google'
                ? 'Google Calendar connected'
                : isBusy
                  ? 'opening Google...'
                  : 'connect Google Calendar'}
            </Text>
          </Pressable>

          <Text style={styles.footnote}>
            Access tokens remain in browser memory and are cleared when the page session ends.
          </Text>
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
    flex: 1,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  backIcon: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 42,
    lineHeight: 44,
  },
  title: {
    flex: 1,
    fontSize: 36,
    letterSpacing: -1.5,
    lineHeight: 39,
    marginLeft: spacing.sm,
  },
  content: {
    gap: spacing.lg,
    marginHorizontal: 'auto',
    maxWidth: 620,
    padding: spacing.lg,
    width: '100%',
  },
  heroCard: {
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 13,
  },
  heroTitle: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 27,
    lineHeight: 32,
    marginTop: spacing.xs,
  },
  body: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 17,
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  permissionCard: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 18,
  },
  allowed: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 17,
  },
  denied: {
    color: colors.muted,
    fontFamily: fonts.hand,
    fontSize: 17,
  },
  divider: {
    borderTopColor: colors.ink,
    borderTopWidth: 1.5,
    marginVertical: spacing.xs,
  },
  warningCard: {
    padding: spacing.lg,
  },
  warningTitle: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 20,
  },
  errorText: {
    color: '#8A2739',
    fontFamily: fonts.handBold,
    fontSize: 15,
    textAlign: 'center',
  },
  connectButton: {
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 2.5,
    justifyContent: 'center',
    minHeight: 62,
  },
  connectButtonText: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 20,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ translateY: 2 }],
  },
  footnote: {
    color: colors.muted,
    fontFamily: fonts.hand,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
