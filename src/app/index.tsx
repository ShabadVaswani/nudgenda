import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCalendar } from '@/calendar/CalendarProvider';
import { presentCalendarEvent } from '@/calendar/presentation';
import { MicButton } from '@/components/MicButton';
import { NeoCard } from '@/components/NeoCard';
import { OutlinedTitle } from '@/components/OutlinedTitle';
import { colors, fonts, spacing } from '@/constants/design';
import type { ScheduleItem } from '@/data/schedule';

function ScheduleBlock({ item, onPress }: { item: ScheduleItem; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint="Opens the Google Calendar event details"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.blockPressed}>
      <NeoCard backgroundColor={item.color} style={styles.scheduleBlock}>
        <Text style={styles.blockSymbol}>{item.symbol}</Text>
        <Text numberOfLines={1} style={styles.blockTitle}>
          {item.title}
        </Text>
        <Text style={styles.blockDoodle}>{item.id === 'morning-routine' ? '✦' : '·'}</Text>
      </NeoCard>
    </Pressable>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { events, isLoading, source, syncError } = useCalendar();
  const schedule = useMemo(() => events.map(presentCalendarEvent), [events]);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      }).format(new Date()),
    [],
  );
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 16 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.4,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 72) {
            router.push('/chat');
          }
        },
      }),
    [router],
  );

  const openChatListening = () => {
    router.push({ pathname: '/chat', params: { listening: '1' } });
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.topGestureArea} {...panResponder.panHandlers}>
          <View style={styles.pullHint}>
            <Text style={styles.pullHintText}>pull down for chat</Text>
          </View>

          <View style={styles.headerRow}>
            <View>
              <OutlinedTitle>TODAY</OutlinedTitle>
              <Text style={styles.date}>{todayLabel}</Text>
            </View>
            <Pressable
              accessibilityLabel="Calendar connection settings"
              onPress={() => router.push('/settings/calendar')}>
              <NeoCard style={styles.blockCount}>
                <Text style={styles.blockCountText}>
                  {isLoading ? 'syncing…' : `${schedule.length} blocks · ${source}`}
                </Text>
              </NeoCard>
            </Pressable>
          </View>
          </View>

          {!!syncError && <Text style={styles.syncError}>{syncError}</Text>}

          <ScrollView
            bounces
            contentContainerStyle={styles.timelineScrollContent}
            showsVerticalScrollIndicator={false}
            style={styles.timelineScroll}>
            <View
              style={[styles.timeline, { minHeight: Math.max(420, schedule.length * 82) }]}>
              <View style={styles.timeRail}>
                {['7 AM', '8 AM', '9 AM', '10 AM', '12 PM', '3 PM', '5 PM'].map((time) => (
                  <Text key={time} style={styles.timeLabel}>
                    {time}
                  </Text>
                ))}
              </View>
              <View style={styles.railLine} />
              <View style={styles.blocks}>
                {schedule.map((item) => (
                  <ScheduleBlock
                    item={item}
                    key={item.id}
                    onPress={() => router.push(`/event/${item.id}`)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.micArea}>
            <MicButton onPress={openChatListening} />
            <Text style={styles.micLabel}>talk to your day</Text>
          </View>
        </View>
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
  content: {
    flex: 1,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  topGestureArea: {
    flexShrink: 0,
  },
  pullHint: {
    alignSelf: 'center',
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  pullHintText: {
    fontFamily: fonts.hand,
    fontSize: 14,
  },
  headerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  date: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 23,
    marginTop: 2,
  },
  blockCount: {
    marginBottom: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  blockCountText: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 15,
  },
  syncError: {
    color: '#8A2739',
    fontFamily: fonts.handBold,
    fontSize: 14,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  timeline: {
    flexDirection: 'row',
  },
  timelineScroll: {
    flex: 1,
  },
  timelineScrollContent: {
    paddingBottom: spacing.sm,
  },
  timeRail: {
    justifyContent: 'space-between',
    paddingVertical: 5,
    width: 54,
  },
  timeLabel: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 14,
    textAlign: 'right',
  },
  railLine: {
    borderLeftColor: colors.ink,
    borderStyle: 'dashed',
    borderLeftWidth: 1.5,
    marginHorizontal: 10,
  },
  blocks: {
    flex: 1,
    gap: spacing.md,
  },
  scheduleBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 67,
    paddingHorizontal: spacing.md,
  },
  blockPressed: {
    opacity: 0.8,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  blockSymbol: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 27,
    marginRight: spacing.md,
    width: 27,
  },
  blockTitle: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.hand,
    fontSize: 22,
  },
  blockDoodle: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 25,
  },
  micArea: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    flexShrink: 0,
    paddingTop: spacing.md,
  },
  micLabel: {
    color: colors.muted,
    fontFamily: fonts.hand,
    fontSize: 14,
    marginTop: spacing.sm,
  },
});
