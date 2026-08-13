import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  type ViewStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCalendar } from '@/calendar/CalendarProvider';
import { presentCalendarEvent } from '@/calendar/presentation';
import type { CalendarEvent } from '@/calendar/types';
import { MicButton } from '@/components/MicButton';
import { NeoCard } from '@/components/NeoCard';
import { OutlinedTitle } from '@/components/OutlinedTitle';
import { getScheduleBlockDensity } from '@/components/scheduleBlockLayout';
import { colors, fonts, spacing } from '@/constants/design';
import type { ScheduleItem } from '@/data/schedule';

const HOUR_HEIGHT = 92;
const EVENT_GAP = 5;
const TITLE_HEIGHT_THRESHOLD = 24;
const MIN_RENDERABLE_EVENT_MINUTES =
  ((TITLE_HEIGHT_THRESHOLD + EVENT_GAP) / HOUR_HEIGHT) * 60;

type TimelineItem = ScheduleItem & {
  endMinute: number;
  lane: number;
  laneCount: number;
  startMinute: number;
};

function getEventDate(value: CalendarEvent['start']) {
  const raw = value.dateTime ?? value.date;
  return raw ? new Date(raw) : undefined;
}

function buildTimeline(events: CalendarEvent[], currentMinute: number) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const allDay: ScheduleItem[] = [];
  const timed: TimelineItem[] = [];

  events.forEach((event) => {
    const presented = presentCalendarEvent(event);
    if (!event.start.dateTime) {
      allDay.push(presented);
      return;
    }

    const start = getEventDate(event.start);
    const end = getEventDate(event.end);
    if (!start || !end) return;

    const startMinute = Math.max(0, Math.min(1440, (start.getTime() - dayStart.getTime()) / 60000));
    const rawEndMinute = Math.max(0, Math.min(1440, (end.getTime() - dayStart.getTime()) / 60000));
    const endMinute = Math.max(startMinute + 1, rawEndMinute);
    if (endMinute - startMinute < MIN_RENDERABLE_EVENT_MINUTES) return;

    timed.push({
      ...presented,
      endMinute,
      lane: 0,
      laneCount: 1,
      startMinute,
    });
  });

  timed.sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

  // Split overlapping events into clusters, then give each event a side-by-side lane.
  for (let clusterStart = 0; clusterStart < timed.length; ) {
    let clusterEnd = clusterStart + 1;
    let latestEnd = timed[clusterStart].endMinute;
    while (clusterEnd < timed.length && timed[clusterEnd].startMinute < latestEnd - 0.01) {
      latestEnd = Math.max(latestEnd, timed[clusterEnd].endMinute);
      clusterEnd += 1;
    }

    const laneEnds: number[] = [];
    for (let index = clusterStart; index < clusterEnd; index += 1) {
      const item = timed[index];
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.startMinute + 0.01);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.endMinute;
      item.lane = lane;
    }
    for (let index = clusterStart; index < clusterEnd; index += 1) {
      timed[index].laneCount = laneEnds.length;
    }
    clusterStart = clusterEnd;
  }

  const earliestMinute = Math.min(timed[0]?.startMinute ?? currentMinute, currentMinute);
  const latestMinute = timed.reduce(
    (latest, item) => Math.max(latest, item.endMinute),
    currentMinute,
  );
  let startHour = Math.max(0, Math.floor(earliestMinute / 60) - 1);
  let endHour = Math.min(24, Math.ceil(latestMinute / 60) + 1);
  if (endHour - startHour < 8) {
    endHour = Math.min(24, startHour + 8);
    startHour = Math.max(0, endHour - 8);
  }

  return {
    allDay,
    endHour,
    hours: Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index),
    items: timed,
    startHour,
  };
}

function formatHour(hour: number) {
  const normalized = hour % 24;
  const suffix = normalized < 12 ? 'AM' : 'PM';
  const clockHour = normalized % 12 || 12;
  return `${clockHour} ${suffix}`;
}

function formatCurrentTime(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

function ScheduleBlock({
  availableHeight,
  item,
  onPress,
  style,
}: {
  availableHeight?: number;
  item: ScheduleItem;
  onPress: () => void;
  style?: ViewStyle;
}) {
  const isAllDay = item.startLabel === 'All day';
  const [layout, setLayout] = useState({
    height: availableHeight ?? 58,
    width: Number.POSITIVE_INFINITY,
  });
  const density = getScheduleBlockDensity(layout);
  const isTiny = density === 'tiny';
  const isCompact = density === 'compact';
  const isLarge = density === 'large';
  const showTitle = !isTiny;
  const showDetails = density === 'standard' || isLarge;
  const showSymbol = showDetails && layout.width >= 160;
  const showDoodle = isLarge && layout.width >= 250;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setLayout((current) =>
      Math.abs(current.height - height) < 0.5 && Math.abs(current.width - width) < 0.5
        ? current
        : { height, width },
    );
  };

  return (
    <Pressable
      accessibilityLabel={`${item.title}, ${isAllDay ? 'all day' : `${item.startLabel} to ${item.endLabel}`}`}
      accessibilityHint="Opens the Google Calendar event details"
      accessibilityRole="button"
      hitSlop={isTiny ? 8 : 0}
      onLayout={handleLayout}
      onPress={onPress}
      style={({ pressed }) => [styles.blockPosition, style, pressed && styles.blockPressed]}>
      <NeoCard
        backgroundColor={item.color}
        shadow={!isTiny}
        style={[
          styles.scheduleBlock,
          isTiny && styles.tinyScheduleBlock,
          isCompact && styles.compactScheduleBlock,
          isLarge && styles.largeScheduleBlock,
        ]}>
        {isTiny && <View style={styles.tinyBlockMark} />}
        {showSymbol && <Text style={styles.blockSymbol}>{item.symbol}</Text>}
        {showTitle && (
          <View style={styles.blockCopy}>
            <Text
              numberOfLines={1}
              style={[
                styles.blockTitle,
                isCompact && styles.compactBlockTitle,
                isLarge && styles.largeBlockTitle,
              ]}>
              {item.title}
            </Text>
            {showDetails && (
              <Text numberOfLines={1} style={styles.blockTime}>
                {isAllDay ? 'All day' : `${item.startLabel}–${item.endLabel}`}
              </Text>
            )}
            {isLarge && (
              <Text numberOfLines={1} style={styles.blockMeta}>
                {item.calendarName}
              </Text>
            )}
          </View>
        )}
        {showDoodle && <Text style={styles.blockDoodle}>·</Text>}
      </NeoCard>
    </Pressable>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const {
    connectDeviceCalendar,
    connectGoogleCalendar,
    connectionStatus,
    events,
    isDeviceCalendarAvailable,
    isGoogleCalendarConfigured,
    isLoading,
    source,
    syncError,
  } = useCalendar();
  const [connectionError, setConnectionError] = useState<string>();
  const [now, setNow] = useState(() => new Date());
  const currentMinute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const timeline = useMemo(() => buildTimeline(events, currentMinute), [currentMinute, events]);
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

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const connectCalendar = useCallback(async () => {
    setConnectionError(undefined);
    try {
      if (isDeviceCalendarAvailable) {
        await connectDeviceCalendar();
      } else {
        await connectGoogleCalendar();
      }
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : 'Google Calendar connection failed',
      );
    }
  }, [connectDeviceCalendar, connectGoogleCalendar, isDeviceCalendarAvailable]);

  const isCalendarConnected = source === 'device' || source === 'google';

  const openEvent = (id: string) =>
    router.push({
      pathname: '/event/[id]',
      params: { id },
    });

  const openChatListening = () => {
    router.push({ pathname: '/chat', params: { listening: '1' } });
  };

  const pixelsPerMinute = HOUR_HEIGHT / 60;
  const timelineHeight = (timeline.endHour - timeline.startHour) * HOUR_HEIGHT;
  const currentTimeTop = (currentMinute - timeline.startHour * 60) * pixelsPerMinute;
  const showCurrentTime =
    currentMinute >= timeline.startHour * 60 && currentMinute <= timeline.endHour * 60;

  if (!isCalendarConnected) {
    const isConnecting =
      connectionStatus === 'checking' || connectionStatus === 'requesting' || isLoading;
    const visibleError = connectionError ?? syncError;

    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.connectionGate} edges={['top', 'bottom']}>
          <OutlinedTitle style={styles.connectionLogo} variant="brand">
            NUDGENDA
          </OutlinedTitle>
          <Text style={styles.connectionGateTagline}>your day, gently nudged into place</Text>

          <NeoCard backgroundColor={colors.aqua} style={styles.connectionGateCard}>
            <Text style={styles.connectionGateTitle}>welcome</Text>
            <Text style={styles.connectionGateBody}>
              Sign in with Google to bring in your calendar and start planning your day.
            </Text>

            <View style={styles.connectionPrivacyRow}>
              <Text style={styles.connectionPrivacyMark}>✓</Text>
              <Text style={styles.connectionPrivacyText}>No separate Nudgenda account</Text>
            </View>
            <View style={styles.connectionPrivacyRow}>
              <Text style={styles.connectionPrivacyMark}>✓</Text>
              <Text style={styles.connectionPrivacyText}>No Gmail access</Text>
            </View>
            <View style={styles.connectionPrivacyRow}>
              <Text style={styles.connectionPrivacyMark}>✓</Text>
              <Text style={styles.connectionPrivacyText}>Calendar access only</Text>
            </View>
          </NeoCard>

          {!!visibleError && <Text style={styles.connectionGateError}>{visibleError}</Text>}

          <Pressable
            accessibilityRole="button"
            disabled={isConnecting || (!isDeviceCalendarAvailable && !isGoogleCalendarConfigured)}
            onPress={() => void connectCalendar()}
            style={({ pressed }) => [
              styles.connectionRetry,
              (isConnecting || (!isDeviceCalendarAvailable && !isGoogleCalendarConfigured)) &&
                styles.connectionRetryDisabled,
              pressed && styles.blockPressed,
            ]}>
            <Text style={styles.googleLetter}>G</Text>
            <Text style={styles.connectionRetryText}>
              {isConnecting ? 'connecting...' : 'Sign in with Google'}
            </Text>
          </Pressable>

          <Text style={styles.connectionTerms}>
            By continuing, you allow Nudgenda to read and manage your Google Calendar events.
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.topGestureArea} {...panResponder.panHandlers}>
            <View style={styles.headerRow}>
              <View>
                <OutlinedTitle>TODAY</OutlinedTitle>
                <Text style={styles.date}>{todayLabel}</Text>
              </View>
              <View style={styles.headerActions}>
                <NeoCard style={styles.blockCount}>
                  <Text style={styles.blockCountText}>
                    {isLoading ? 'syncing…' : `${events.length} blocks · ${source}`}
                  </Text>
                </NeoCard>
                <Pressable
                  accessibilityLabel="Open settings"
                  onPress={() => router.push('/settings/calendar')}
                  style={({ pressed }) => [styles.settingsButton, pressed && styles.blockPressed]}>
                  <Text style={styles.settingsIcon}>⚙</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {!!syncError && <Text style={styles.syncError}>{syncError}</Text>}

          <ScrollView
            bounces
            contentContainerStyle={styles.timelineScrollContent}
            showsVerticalScrollIndicator={false}
            style={styles.timelineScroll}>
            {timeline.allDay.length > 0 && (
              <View style={styles.allDaySection}>
                <Text style={styles.allDayLabel}>all day</Text>
                <View style={styles.allDayBlocks}>
                  {timeline.allDay.map((item) => (
                    <ScheduleBlock item={item} key={item.id} onPress={() => openEvent(item.id)} />
                  ))}
                </View>
              </View>
            )}

            <View style={[styles.timeline, { height: timelineHeight }]}>
              {timeline.hours.map((hour) => (
                <View
                  key={hour}
                  pointerEvents="none"
                  style={[styles.hourRow, { top: (hour - timeline.startHour) * HOUR_HEIGHT }]}>
                  <Text style={styles.timeLabel}>{formatHour(hour)}</Text>
                  <View style={styles.hourRule} />
                </View>
              ))}

              {showCurrentTime && (
                <View
                  pointerEvents="none"
                  style={[styles.currentTimeRow, { top: currentTimeTop }]}>
                  <Text style={styles.currentTimeLabel}>{formatCurrentTime(now)}</Text>
                  <View style={styles.currentTimeDot} />
                  <View style={styles.currentTimeRule} />
                </View>
              )}

              <View style={styles.blocksCanvas}>
                {timeline.items.map((item) => {
                  const laneWidth = 100 / item.laneCount;
                  const top = (item.startMinute - timeline.startHour * 60) * pixelsPerMinute;
                  const durationHeight = (item.endMinute - item.startMinute) * pixelsPerMinute;
                  const renderedHeight = Math.max(6, durationHeight - EVENT_GAP);

                  return (
                    <ScheduleBlock
                      availableHeight={renderedHeight}
                      item={item}
                      key={item.id}
                      onPress={() => openEvent(item.id)}
                      style={{
                        height: renderedHeight,
                        left: `${item.lane * laneWidth}%`,
                        paddingHorizontal: item.laneCount > 1 ? 3 : 0,
                        position: 'absolute',
                        top: top + 2,
                        width: `${laneWidth}%`,
                      }}
                    />
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.micArea}>
            <MicButton onPress={openChatListening} />
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
  connectionGate: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 'auto',
    maxWidth: 520,
    padding: spacing.xl,
    width: '100%',
  },
  connectionLogo: {
    alignSelf: 'center',
    textAlign: 'center',
  },
  connectionGateTagline: {
    color: colors.muted,
    fontFamily: fonts.hand,
    fontSize: 19,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  connectionGateCard: {
    marginTop: spacing.xl,
    padding: spacing.xl,
    width: '100%',
  },
  connectionGateTitle: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 27,
    textAlign: 'center',
  },
  connectionGateBody: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 18,
    lineHeight: 25,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  connectionPrivacyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  connectionPrivacyMark: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 18,
    marginRight: spacing.sm,
  },
  connectionPrivacyText: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.hand,
    fontSize: 17,
  },
  connectionGateError: {
    color: '#8A2739',
    fontFamily: fonts.handBold,
    fontSize: 15,
    lineHeight: 21,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  connectionRetry: {
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 2.5,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    shadowColor: colors.ink,
    shadowOffset: { height: 5, width: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    width: '100%',
  },
  connectionRetryDisabled: {
    opacity: 0.45,
  },
  connectionRetryText: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 19,
  },
  googleLetter: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 16,
    borderWidth: 1.5,
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 19,
    height: 32,
    lineHeight: 29,
    textAlign: 'center',
    width: 32,
  },
  connectionTerms: {
    color: colors.muted,
    fontFamily: fonts.hand,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.lg,
    maxWidth: 390,
    textAlign: 'center',
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 820,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  topGestureArea: {
    flexShrink: 0,
    paddingTop: spacing.sm,
  },
  headerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
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
  settingsButton: {
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: 11,
    borderWidth: 2,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  settingsIcon: {
    color: colors.ink,
    fontSize: 22,
  },
  syncError: {
    color: '#8A2739',
    fontFamily: fonts.handBold,
    fontSize: 14,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  timeline: {
    position: 'relative',
  },
  timelineScroll: {
    flex: 1,
  },
  timelineScrollContent: {
    paddingBottom: spacing.sm,
  },
  allDaySection: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  allDayLabel: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 14,
    paddingTop: 14,
    textAlign: 'right',
    width: 54,
  },
  allDayBlocks: {
    flex: 1,
    gap: spacing.sm,
    marginLeft: 20,
  },
  hourRow: {
    alignItems: 'center',
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  timeLabel: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 14,
    textAlign: 'right',
    width: 54,
  },
  hourRule: {
    borderTopColor: colors.ink,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    flex: 1,
    marginLeft: 10,
    opacity: 0.42,
  },
  currentTimeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    right: 0,
    transform: [{ translateY: -10 }],
    zIndex: 1,
  },
  currentTimeLabel: {
    backgroundColor: colors.pink,
    borderColor: colors.ink,
    borderRadius: 8,
    borderWidth: 1.5,
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 12,
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 1,
    textAlign: 'center',
    width: 62,
  },
  currentTimeDot: {
    backgroundColor: colors.pink,
    borderColor: colors.ink,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 10,
    marginLeft: 3,
    width: 10,
  },
  currentTimeRule: {
    backgroundColor: colors.pink,
    borderBottomColor: colors.ink,
    borderBottomWidth: 1,
    flex: 1,
    height: 3,
  },
  blocksCanvas: {
    bottom: 0,
    left: 74,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  blockPosition: {
    height: 58,
  },
  scheduleBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    height: '100%',
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  tinyScheduleBlock: {
    borderRadius: 5,
    borderWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  compactScheduleBlock: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
  },
  largeScheduleBlock: {
    paddingVertical: spacing.sm,
  },
  tinyBlockMark: {
    backgroundColor: colors.ink,
    borderRadius: 2,
    height: 2,
    maxWidth: 24,
    opacity: 0.35,
    width: '35%',
  },
  blockPressed: {
    opacity: 0.8,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  blockSymbol: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 24,
    marginRight: spacing.sm,
    width: 27,
  },
  blockCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  blockTitle: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 20,
    lineHeight: 23,
  },
  compactBlockTitle: {
    fontSize: 16,
    lineHeight: 18,
  },
  largeBlockTitle: {
    fontSize: 21,
    lineHeight: 24,
  },
  blockTime: {
    color: colors.muted,
    fontFamily: fonts.hand,
    fontSize: 13,
    marginTop: 1,
  },
  blockMeta: {
    color: colors.muted,
    fontFamily: fonts.hand,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.9,
  },
  blockDoodle: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 25,
    marginLeft: spacing.xs,
  },
  micArea: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    flexShrink: 0,
    paddingTop: spacing.md,
  },
});
