import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCalendar } from '@/calendar/CalendarProvider';
import { NeoCard } from '@/components/NeoCard';
import { OutlinedTitle } from '@/components/OutlinedTitle';
import { colors, fonts, spacing } from '@/constants/design';

export default function CalendarSettingsScreen() {
  const router = useRouter();
  const {
    calendarAccountLabel,
    calendarCount,
    calendarPermission,
    connectDeviceCalendar,
    connectionStatus,
    isDeviceCalendarAvailable,
    permissionCanAskAgain,
    refresh,
    source,
    syncError,
  } = useCalendar();
  const isBusy = connectionStatus === 'checking' || connectionStatus === 'requesting';

  const connect = async () => {
    if (!isDeviceCalendarAvailable) {
      Alert.alert(
        'Android app required',
        'Device calendar access works in the installable Android app. The browser preview keeps using sample events.',
      );
      return;
    }
    if (source === 'device') {
      await refresh();
      return;
    }
    if (calendarPermission === 'denied' && !permissionCanAskAgain) {
      Alert.alert(
        'Calendar permission is off',
        'Open Android settings and allow Calendar access for Nudgenda.',
        [
          { style: 'cancel', text: 'not now' },
          { onPress: () => void Linking.openSettings(), text: 'open settings' },
        ],
      );
      return;
    }
    try {
      await connectDeviceCalendar();
    } catch (error) {
      Alert.alert(
        'Could not use device calendar',
        error instanceof Error ? error.message : 'Calendar access failed',
      );
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" hitSlop={12} onPress={() => router.back()}>
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </Pressable>
          <OutlinedTitle style={styles.title}>CALENDAR</OutlinedTitle>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <NeoCard backgroundColor={colors.aqua} style={styles.statusCard}>
            <Text style={styles.eyebrow}>CURRENT SOURCE</Text>
            <Text style={styles.statusTitle}>
              {source === 'device' ? 'device Google calendar' : 'demo calendar'}
            </Text>
            <Text style={styles.body}>
              {source === 'device'
                ? `${calendarCount} synced Google calendar${calendarCount === 1 ? '' : 's'} available${
                    calendarAccountLabel ? ` for ${calendarAccountLabel}` : ''
                  }.`
                : 'Sample events stay active until calendar permission is granted in the Android app.'}
            </Text>
            {!!syncError && <Text style={styles.errorText}>{syncError}</Text>}
          </NeoCard>

          <NeoCard style={styles.permissionsCard}>
            <Text style={styles.sectionTitle}>LOCAL ACCESS</Text>
            <Text style={styles.permission}>read events already synced to this phone</Text>
            <Text style={styles.permission}>create, rearrange, and delete calendar events</Text>
            <Text style={styles.permissionMuted}>no Gmail access</Text>
            <Text style={styles.permissionMuted}>no Google Cloud project</Text>
            <Text style={styles.permissionMuted}>no Nudgenda backend</Text>
          </NeoCard>

          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => void connect()}
            style={({ pressed }) => [
              styles.connectButton,
              isBusy && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.connectButtonText}>
              {isBusy
                ? 'checking calendar...'
                : source === 'device'
                  ? 'refresh device calendar'
                  : 'allow calendar access'}
            </Text>
          </Pressable>

          <Text style={styles.footnote}>
            Android keeps the on-device calendar synchronized with the Google account already on
            your phone. Nudgenda never receives your Google password.
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
    fontSize: 39,
    letterSpacing: -1.7,
    lineHeight: 44,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  statusCard: {
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 13,
  },
  statusTitle: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 27,
    marginTop: spacing.xs,
  },
  body: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 17,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  errorText: {
    color: '#8A2739',
    fontFamily: fonts.handBold,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  permissionsCard: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  sectionTitle: {
    borderBottomColor: colors.ink,
    borderBottomWidth: 1.5,
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 20,
    marginBottom: spacing.xs,
    paddingBottom: spacing.sm,
  },
  permission: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 17,
  },
  permissionMuted: {
    color: colors.muted,
    fontFamily: fonts.hand,
    fontSize: 17,
  },
  connectButton: {
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 2.5,
    justifyContent: 'center',
    minHeight: 60,
  },
  connectButtonText: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 20,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ translateY: 2 }],
  },
  disabled: {
    opacity: 0.55,
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
