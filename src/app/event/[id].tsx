import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCalendar } from '@/calendar/CalendarProvider';
import { presentCalendarEvent } from '@/calendar/presentation';
import { NeoCard } from '@/components/NeoCard';
import { OutlinedTitle } from '@/components/OutlinedTitle';
import { colors, fonts, spacing } from '@/constants/design';

export default function EventDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { getEvent, isLoading, openEvent } = useCalendar();
  const calendarEvent = getEvent(params.id);

  if (!calendarEvent) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.missingEvent}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.missingEventText}>
            {isLoading ? 'loading event...' : 'event not found'}
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  const event = presentCalendarEvent(calendarEvent);
  const openInCalendar = async () => {
    try {
      if (!(await openEvent(calendarEvent.id))) {
        Alert.alert(
          'Demo calendar',
          'System calendar events open from the installable Android app.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Could not open event',
        error instanceof Error ? error.message : 'The system calendar could not open this event.',
      );
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}>
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </Pressable>
          <OutlinedTitle style={styles.title}>{'EVENT\nDETAILS'}</OutlinedTitle>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <NeoCard backgroundColor={event.color} style={styles.eventCard}>
            <View style={styles.eventTitleRow}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.listIcon}>{'\u2637'}</Text>
            </View>
            <Text style={styles.eventMeta}>{'\u25A3  '}{event.dateLabel}</Text>
            <Text style={styles.eventMeta}>
              {'\u25F7  '}{event.startLabel}{'\u2013'}{event.endLabel}
            </Text>

            {!!event.description?.length && (
              <View style={styles.description}>
                <Text style={styles.sectionLabel}>DESCRIPTION</Text>
                {event.description.map((line) => (
                  <Text key={line} style={styles.descriptionLine}>
                    {line}
                  </Text>
                ))}
              </View>
            )}
          </NeoCard>

          <NeoCard style={styles.fieldCard}>
            <Text style={styles.fieldIcon}>{'\u25A3'}</Text>
            <Text style={styles.fieldLabel}>Calendar</Text>
            <Text style={styles.fieldValue}>  {event.calendarName}</Text>
            <Text style={styles.chevron}>{'\u203A'}</Text>
          </NeoCard>

          {!!event.reminderLabel && (
            <NeoCard style={styles.fieldCard}>
              <Text style={styles.fieldIcon}>{'\u2667'}</Text>
              <Text style={styles.fieldLabel}>Reminder</Text>
              <Text style={styles.fieldValue}>  {event.reminderLabel}</Text>
              <Text style={styles.chevron}>{'\u203A'}</Text>
            </NeoCard>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => void openInCalendar()}
            style={({ pressed }) => [styles.openButton, pressed && styles.buttonPressed]}>
            <Text style={styles.openButtonText}>{'\u2197  '}open in system calendar</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.aquaPaper,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  missingEvent: {
    flex: 1,
    padding: spacing.lg,
  },
  missingEventText: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 24,
    marginTop: spacing.xl,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 42,
  },
  backIcon: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 42,
    lineHeight: 44,
  },
  title: {
    flex: 1,
    fontSize: 39,
    letterSpacing: -1.7,
    lineHeight: 42,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  eventCard: {
    padding: spacing.md,
  },
  eventTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventTitle: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.handBold,
    fontSize: 24,
  },
  listIcon: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 30,
  },
  eventMeta: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 18,
    lineHeight: 28,
  },
  description: {
    backgroundColor: colors.paper,
    borderColor: colors.ink,
    borderRadius: 11,
    borderWidth: 2,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  sectionLabel: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  descriptionLine: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 18,
    lineHeight: 30,
  },
  fieldCard: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: spacing.md,
  },
  fieldIcon: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 21,
    marginRight: spacing.sm,
  },
  fieldLabel: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 17,
  },
  fieldValue: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.hand,
    fontSize: 17,
    marginLeft: spacing.xs,
  },
  chevron: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 30,
  },
  openButton: {
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 2.5,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 58,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ translateY: 2 }],
  },
  openButtonText: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 18,
  },
});
