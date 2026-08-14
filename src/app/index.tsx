import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCalendar } from '@/calendar/CalendarProvider';
import { deduplicateCalendarEvents } from '@/calendar/deduplicate';
import {
  minuteFromLocalDay,
  nextLocalDay,
  shouldShowTomorrow,
} from '@/calendar/homeRange';
import { presentCalendarEvent } from '@/calendar/presentation';
import {
  clamp,
  conflictingEvents,
  formatMinuteOfDay,
  shiftedEventTimes,
  snappedStartMinute,
} from '@/calendar/reschedule';
import {
  assignTimelineLanes,
  getAdaptiveHourHeight,
} from '@/calendar/timelineScale';
import type { CalendarEvent } from '@/calendar/types';
import { MicButton } from '@/components/MicButton';
import { NeoCard } from '@/components/NeoCard';
import { OutlinedTitle } from '@/components/OutlinedTitle';
import { getScheduleBlockDensity } from '@/components/scheduleBlockLayout';
import { colors, fonts, spacing } from '@/constants/design';
import type { ScheduleItem } from '@/data/schedule';
import { isUpwardChatIntent, shouldOpenChatFromSwipe } from '@/navigation/homeChatGesture';

const EVENT_GAP = 5;
let retainedTimelineScrollOffset = 0;

type TimelineItem = ScheduleItem & {
  calendarEvent: CalendarEvent;
  endMinute: number;
  lane: number;
  laneCount: number;
  startMinute: number;
  visualEndMinute: number;
};

type DragState = {
  conflicts: CalendarEvent[];
  item: TimelineItem;
  originalScrollOffset: number;
  saving: boolean;
  targetStartMinute: number;
};

function getEventDate(value: CalendarEvent['start']) {
  const raw = value.dateTime ?? value.date;
  return raw ? new Date(raw) : undefined;
}

function buildTimeline(
  events: CalendarEvent[],
  currentMinute: number,
  referenceDay: Date,
  includeTomorrow: boolean,
) {
  const maximumMinute = includeTomorrow ? 2880 : 1440;

  const allDay: ScheduleItem[] = [];
  const timed: Omit<TimelineItem, 'lane' | 'laneCount' | 'visualEndMinute'>[] = [];

  events.forEach((event) => {
    const presented = presentCalendarEvent(event);
    if (!event.start.dateTime) {
      allDay.push(presented);
      return;
    }

    const start = getEventDate(event.start);
    const end = getEventDate(event.end);
    if (!start || !end) return;

    const startMinute = clamp(
      minuteFromLocalDay(start, referenceDay), 0, maximumMinute);
    const rawEndMinute = clamp(
      minuteFromLocalDay(end, referenceDay), 0, maximumMinute);
    const endMinute = Math.max(startMinute + 1, rawEndMinute);

    timed.push({
      ...presented,
      calendarEvent: event,
      endMinute,
      startMinute,
    });
  });

  timed.sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
  const laidOut = assignTimelineLanes(timed);
  const hourHeight = getAdaptiveHourHeight(
    laidOut.map((item) => item.endMinute - item.startMinute),
  );

  const earliestMinute = Math.min(laidOut[0]?.startMinute ?? currentMinute, currentMinute);
  const latestMinute = laidOut.reduce(
    (latest, item) => Math.max(latest, item.visualEndMinute),
    currentMinute,
  );
  let startHour = Math.max(0, Math.floor(earliestMinute / 60) - 1);
  const maximumHour = includeTomorrow ? 48 : 24;
  let endHour = Math.min(maximumHour, Math.ceil(latestMinute / 60) + 1);
  if (endHour - startHour < 8) {
    endHour = Math.min(maximumHour, startHour + 8);
    startHour = Math.max(0, endHour - 8);
  }

  return {
    allDay,
    endHour,
    hourHeight,
    hours: Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index),
    items: laidOut,
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
  dragItem,
  item,
  onDragCancel,
  onDragEnd,
  onDragStart,
  onDragUpdate,
  onPress,
  style,
}: {
  availableHeight?: number;
  dragItem?: TimelineItem;
  item: ScheduleItem;
  onDragCancel?: () => void;
  onDragEnd?: () => void;
  onDragStart?: (item: TimelineItem) => void;
  onDragUpdate?: (translationY: number, absoluteY: number) => void;
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
  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(Boolean(dragItem && onDragStart))
        .activateAfterLongPress(420)
        .minDistance(1)
        .onStart(() => {
          if (dragItem) onDragStart?.(dragItem);
        })
        .onUpdate((event) => onDragUpdate?.(event.translationY, event.absoluteY))
        .onEnd(() => onDragEnd?.())
        .onFinalize((_event, success) => {
          if (!success) onDragCancel?.();
        })
        .runOnJS(true),
    [dragItem, onDragCancel, onDragEnd, onDragStart, onDragUpdate],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setLayout((current) =>
      Math.abs(current.height - height) < 0.5 && Math.abs(current.width - width) < 0.5
        ? current
        : { height, width },
    );
  };

  return (
    <GestureDetector gesture={dragGesture}>
      <Pressable
      accessibilityLabel={`${item.title}, ${isAllDay ? 'all day' : `${item.startLabel} to ${item.endLabel}`}`}
      accessibilityHint={
        dragItem
          ? 'Tap for details, or hold and drag vertically to change the time'
          : 'Opens the Google Calendar event details'
      }
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
    </GestureDetector>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const {
    connectDeviceCalendar,
    connectGoogleCalendar,
    connectionStatus,
    events,
    isDeviceCalendarAvailable,
    isGoogleCalendarConfigured,
    isLoading,
    openEvent: openCalendarEvent,
    refresh,
    source,
    syncError,
    updateEvent,
  } = useCalendar();
  const [connectionError, setConnectionError] = useState<string>();
  const [dragState, setDragState] = useState<DragState>();
  const [moveMessage, setMoveMessage] = useState<string>();
  const [pendingRecurringDrop, setPendingRecurringDrop] = useState<DragState>();
  const [now, setNow] = useState(() => new Date());
  const autoScrollDirection = useRef<-1 | 0 | 1>(0);
  const dragStateRef = useRef<DragState | undefined>(undefined);
  const lastDragTranslation = useRef(0);
  const scrollOffset = useRef(retainedTimelineScrollOffset);
  const scrollView = useRef<ScrollView>(null);
  const timelineViewport = useRef({ bottom: 0, height: 0, top: 0 });
  const currentMinute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const showTomorrow = shouldShowTomorrow(now);
  const displayedEvents = useMemo(() => deduplicateCalendarEvents(events), [events]);
  const timeline = useMemo(
    () => buildTimeline(displayedEvents, currentMinute, now, showTomorrow),
    [currentMinute, displayedEvents, now, showTomorrow],
  );
  const pixelsPerMinute = timeline.hourHeight / 60;
  const timelineHeight = (timeline.endHour - timeline.startHour) * timeline.hourHeight;
  const currentTimeTop = (currentMinute - timeline.startHour * 60) * pixelsPerMinute;
  const showCurrentTime =
    currentMinute >= timeline.startHour * 60 && currentMinute <= timeline.endHour * 60;
  const showTomorrowDivider =
    showTomorrow && timeline.startHour <= 24 && timeline.endHour >= 24;
  const todayLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    });
    const today = formatter.format(now);
    return showTomorrow
      ? `${today} - tomorrow ${formatter.format(nextLocalDay(now))}`
      : today;
  }, [now, showTomorrow]);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => isUpwardChatIntent(gesture),
        onPanResponderRelease: (_, gesture) => {
          if (shouldOpenChatFromSwipe(gesture)) {
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

  const previousShowTomorrow = useRef(showTomorrow);
  useEffect(() => {
    if (previousShowTomorrow.current === showTomorrow) return;
    previousShowTomorrow.current = showTomorrow;
    void refresh();
  }, [refresh, showTomorrow]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollView.current?.scrollTo({
        animated: false,
        y: retainedTimelineScrollOffset,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [timelineHeight]);

  const setDragSnapshot = useCallback((next?: DragState) => {
    dragStateRef.current = next;
    setDragState(next);
  }, []);

  const cancelDrag = useCallback(() => {
    autoScrollDirection.current = 0;
    lastDragTranslation.current = 0;
    setPendingRecurringDrop(undefined);
    setDragSnapshot(undefined);
  }, [setDragSnapshot]);

  const applyDragPosition = useCallback(
    (translationY: number) => {
      const current = dragStateRef.current;
      if (!current || current.saving) return;
      const durationMinutes = current.item.endMinute - current.item.startMinute;
      const snapped = snappedStartMinute({
        durationMinutes,
        maximumMinute: timeline.endHour * 60,
        originalStartMinute: current.item.startMinute,
        pixelsPerMinute,
        scrollDelta: scrollOffset.current - current.originalScrollOffset,
        translationY,
      });
      const minimum = timeline.startHour * 60;
      const maximum = Math.max(minimum, timeline.endHour * 60 - durationMinutes);
      const targetStartMinute = clamp(snapped, minimum, maximum);
      const conflicts = conflictingEvents(
        displayedEvents,
        current.item.id,
        targetStartMinute,
        targetStartMinute + durationMinutes,
        now,
      );
      setDragSnapshot({ ...current, conflicts, targetStartMinute });
    },
    [displayedEvents, now, pixelsPerMinute, setDragSnapshot, timeline.endHour, timeline.startHour],
  );

  const startDrag = useCallback(
    (item: TimelineItem) => {
      setMoveMessage(undefined);
      if (!item.canModify) {
        setMoveMessage(`“${item.title}” is on a read-only calendar and cannot be moved here.`);
        return;
      }
      const next: DragState = {
        conflicts: [],
        item,
        originalScrollOffset: scrollOffset.current,
        saving: false,
        targetStartMinute: item.startMinute,
      };
      lastDragTranslation.current = 0;
      setDragSnapshot(next);
    },
    [setDragSnapshot],
  );

  const updateDrag = useCallback(
    (translationY: number, absoluteY: number) => {
      if (!dragStateRef.current) return;
      lastDragTranslation.current = translationY;
      const edge = 62;
      const viewport = timelineViewport.current;
      autoScrollDirection.current =
        absoluteY < viewport.top + edge
          ? -1
          : absoluteY > viewport.bottom - edge
            ? 1
            : 0;
      applyDragPosition(translationY);
    },
    [applyDragPosition],
  );

  const commitDrop = useCallback(
    async (drop: DragState) => {
      setPendingRecurringDrop(undefined);
      setDragSnapshot({ ...drop, saving: true });
      try {
        const changes = shiftedEventTimes(drop.item.calendarEvent, drop.targetStartMinute, now);
        await updateEvent(
          drop.item.id,
          changes,
          drop.item.calendarEvent.calendarId,
          {
            instanceStart: drop.item.calendarEvent.start,
            recurringEventId: drop.item.calendarEvent.recurringEventId,
            scope: 'single',
          },
        );
        setMoveMessage(
          `Moved “${drop.item.title}” to ${formatMinuteOfDay(drop.targetStartMinute)}.`,
        );
        cancelDrag();
      } catch (error) {
        cancelDrag();
        setMoveMessage(
          error instanceof Error ? error.message : 'The calendar could not save the new time.',
        );
      }
    },
    [cancelDrag, now, setDragSnapshot, updateEvent],
  );

  const finishDrag = useCallback(() => {
    autoScrollDirection.current = 0;
    const current = dragStateRef.current;
    if (!current || current.saving) return;
    if (current.targetStartMinute === current.item.startMinute) {
      cancelDrag();
      return;
    }
    if (current.item.isRecurring) {
      setPendingRecurringDrop(current);
      return;
    }
    void commitDrop(current);
  }, [cancelDrag, commitDrop]);

  const handleTimelineScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
    retainedTimelineScrollOffset = event.nativeEvent.contentOffset.y;
  }, []);

  const measureTimelineViewport = useCallback(() => {
    const measurable = scrollView.current as unknown as
      | { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void }
      | null;
    measurable?.measureInWindow((_x, y, _width, height) => {
      timelineViewport.current = { bottom: y + height, height, top: y };
    });
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const timer = setInterval(() => {
      if (!autoScrollDirection.current) return;
      const maximum = Math.max(0, timelineHeight - timelineViewport.current.height);
      const nextOffset = clamp(
        scrollOffset.current + autoScrollDirection.current * 14,
        0,
        maximum,
      );
      if (nextOffset === scrollOffset.current) return;
      scrollOffset.current = nextOffset;
      scrollView.current?.scrollTo({ animated: false, y: nextOffset });
      applyDragPosition(lastDragTranslation.current);
    }, 50);
    return () => clearInterval(timer);
  }, [applyDragPosition, dragState, timelineHeight]);

  useEffect(() => {
    if (!dragState) return;
    const cancel = () => {
      cancelDrag();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', cancel);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    if (Platform.OS === 'web') document.addEventListener('keydown', onKeyDown);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') document.removeEventListener('keydown', onKeyDown);
    };
  }, [cancelDrag, dragState]);

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

  const isCalendarConnected = source === 'device' || source === 'google' || preview === '1';

  const openEventDetails = (id: string) =>
    router.push({
      pathname: '/event/[id]',
      params: { id },
    });

  const openChatListening = () => {
    router.push({ pathname: '/chat', params: { listening: '1' } });
  };

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
          <View style={styles.topGestureArea}>
            <View style={styles.headerRow}>
              <View>
                <OutlinedTitle>TODAY</OutlinedTitle>
                <Text style={styles.date}>{todayLabel}</Text>
              </View>
              <View style={styles.headerActions}>
                <NeoCard style={styles.blockCount}>
                  <Text style={styles.blockCountText}>
                    {isLoading ? 'syncing…' : `${displayedEvents.length} blocks · ${source}`}
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
          {!!moveMessage && (
            <Pressable accessibilityRole="button" onPress={() => setMoveMessage(undefined)}>
              <NeoCard
                backgroundColor={moveMessage.startsWith('Moved') ? colors.lime : colors.pink}
                style={styles.moveMessage}>
                <Text style={styles.moveMessageText}>{moveMessage}</Text>
                <Text style={styles.moveMessageDismiss}>×</Text>
              </NeoCard>
            </Pressable>
          )}
          {!!dragState && (
            <NeoCard backgroundColor={colors.yellow} style={styles.dragToolbar}>
              <View style={styles.dragToolbarCopy}>
                <Text numberOfLines={1} style={styles.dragToolbarTitle}>
                  {dragState.saving ? 'saving…' : `moving ${dragState.item.title}`}
                </Text>
                <Text style={styles.dragToolbarTime}>
                  {formatMinuteOfDay(dragState.targetStartMinute)}–
                  {formatMinuteOfDay(
                    dragState.targetStartMinute +
                      dragState.item.endMinute -
                      dragState.item.startMinute,
                  )}
                  {dragState.conflicts.length
                    ? ` · overlaps ${dragState.conflicts.map((event) => event.summary).join(', ')}`
                    : ' · no conflicts'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Cancel moving event"
                disabled={dragState.saving}
                hitSlop={8}
                onPress={cancelDrag}
                style={styles.dragCancelButton}>
                <Text style={styles.dragCancelText}>cancel</Text>
              </Pressable>
            </NeoCard>
          )}

          <ScrollView
            bounces
            contentContainerStyle={styles.timelineScrollContent}
            onLayout={measureTimelineViewport}
            onScroll={handleTimelineScroll}
            ref={scrollView}
            scrollEnabled={!dragState}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={styles.timelineScroll}>
            {timeline.allDay.length > 0 && (
              <View style={styles.allDaySection}>
                <Text style={styles.allDayLabel}>all day</Text>
                <View style={styles.allDayBlocks}>
                  {timeline.allDay.map((item) => (
                    <ScheduleBlock
                      item={item}
                      key={item.id}
                      onPress={() => openEventDetails(item.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            <View style={[styles.timeline, { height: timelineHeight }]}>
              <LinearGradient
                colors={[
                  'rgba(116, 157, 211, 0.07)',
                  'rgba(250, 211, 74, 0.10)',
                  'rgba(250, 211, 74, 0.06)',
                  'rgba(244, 154, 111, 0.09)',
                  'rgba(116, 157, 211, 0.10)',
                ]}
                locations={[0, 0.25, 0.45, 0.72, 1]}
                pointerEvents="none"
                style={[
                  styles.dayAtmosphere,
                  {
                    height: timeline.hourHeight * 24,
                    top: -timeline.startHour * timeline.hourHeight,
                  },
                ]}
              />
              {showTomorrow && (
                <LinearGradient
                  colors={[
                    'rgba(102, 151, 205, 0.10)',
                    'rgba(246, 218, 116, 0.08)',
                    'rgba(246, 218, 116, 0.05)',
                    'rgba(224, 151, 125, 0.08)',
                    'rgba(102, 151, 205, 0.12)',
                  ]}
                  locations={[0, 0.25, 0.45, 0.72, 1]}
                  pointerEvents="none"
                  style={[
                    styles.dayAtmosphere,
                    {
                      height: timeline.hourHeight * 24,
                      top: (24 - timeline.startHour) * timeline.hourHeight,
                    },
                  ]}
                />
              )}
              {timeline.hours.filter((hour) => !(showTomorrowDivider && hour === 24)).map((hour) => (
                <View
                  key={hour}
                  pointerEvents="none"
                  style={[
                    styles.hourRow,
                    { top: (hour - timeline.startHour) * timeline.hourHeight },
                  ]}>
                  <Text style={styles.timeLabel}>{formatHour(hour)}</Text>
                  <View style={styles.hourRule} />
                </View>
              ))}

              {showTomorrowDivider && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.tomorrowRow,
                    { top: (24 - timeline.startHour) * timeline.hourHeight },
                  ]}>
                  <Text style={styles.tomorrowLabel}>
                    TOMORROW - {new Intl.DateTimeFormat(undefined, {
                      day: 'numeric',
                      month: 'short',
                    }).format(nextLocalDay(now))}
                  </Text>
                  <View style={styles.tomorrowRule} />
                </View>
              )}

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
                  const durationHeight =
                    (item.visualEndMinute - item.startMinute) * pixelsPerMinute;
                  const renderedHeight = Math.max(6, durationHeight - EVENT_GAP);

                  return (
                    <ScheduleBlock
                      availableHeight={renderedHeight}
                      dragItem={item}
                      item={item}
                      key={item.id}
                      onDragCancel={cancelDrag}
                      onDragEnd={finishDrag}
                      onDragStart={startDrag}
                      onDragUpdate={updateDrag}
                      onPress={() => openEventDetails(item.id)}
                      style={{
                        height: renderedHeight,
                        left: `${item.lane * laneWidth}%`,
                        opacity: dragState?.item.id === item.id ? 0.22 : 1,
                        paddingHorizontal: item.laneCount > 1 ? 3 : 0,
                        position: 'absolute',
                        top: top + 2,
                        width: `${laneWidth}%`,
                      }}
                    />
                  );
                })}
                {!!dragState && (() => {
                  const item = dragState.item;
                  const laneWidth = 100 / item.laneCount;
                  const durationHeight =
                    (item.visualEndMinute - item.startMinute) * pixelsPerMinute;
                  const renderedHeight = Math.max(6, durationHeight - EVENT_GAP);
                  const previewItem = {
                    ...item,
                    endLabel: formatMinuteOfDay(
                      dragState.targetStartMinute + item.endMinute - item.startMinute,
                    ),
                    startLabel: formatMinuteOfDay(dragState.targetStartMinute),
                  };
                  return (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.dragPreview,
                        {
                          height: renderedHeight,
                          left: `${item.lane * laneWidth}%`,
                          paddingHorizontal: item.laneCount > 1 ? 3 : 0,
                          top:
                            (dragState.targetStartMinute - timeline.startHour * 60) *
                              pixelsPerMinute + 2,
                          width: `${laneWidth}%`,
                        },
                      ]}>
                      <ScheduleBlock
                        availableHeight={renderedHeight}
                        item={previewItem}
                        onPress={() => undefined}
                        style={{ height: renderedHeight }}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.dragPreviewBadge,
                          dragState.conflicts.length > 0 && styles.dragPreviewConflict,
                        ]}>
                        {dragState.conflicts.length
                          ? `${dragState.conflicts.length} conflict${dragState.conflicts.length === 1 ? '' : 's'}`
                          : 'drop here'}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            </View>
          </ScrollView>

          <View style={styles.micArea} {...panResponder.panHandlers}>
            <MicButton onPress={openChatListening} />
          </View>
        </View>
      </SafeAreaView>
      <Modal
        animationType="fade"
        onRequestClose={cancelDrag}
        transparent
        visible={Boolean(pendingRecurringDrop)}>
        <View style={styles.modalBackdrop}>
          <NeoCard backgroundColor={colors.paper} style={styles.recurringCard}>
            <Text style={styles.recurringTitle}>recurring event</Text>
            <Text style={styles.recurringBody}>
              Move only this occurrence, or open Calendar to choose how the whole series changes.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (pendingRecurringDrop) void commitDrop(pendingRecurringDrop);
              }}
              style={({ pressed }) => [
                styles.recurringPrimaryButton,
                pressed && styles.blockPressed,
              ]}>
              <Text style={styles.recurringPrimaryText}>move this occurrence</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const drop = pendingRecurringDrop;
                if (!drop) return;
                void openCalendarEvent(drop.item.id)
                  .then((opened) => {
                    if (!opened) setMoveMessage('Calendar could not open this recurring event.');
                  })
                  .catch((error: unknown) => {
                    setMoveMessage(
                      error instanceof Error ? error.message : 'Calendar could not open the series.',
                    );
                  })
                  .finally(cancelDrag);
              }}
              style={({ pressed }) => [
                styles.recurringSecondaryButton,
                pressed && styles.blockPressed,
              ]}>
              <Text style={styles.recurringSecondaryText}>edit the series in Calendar</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={cancelDrag} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>keep original time</Text>
            </Pressable>
          </NeoCard>
        </View>
      </Modal>
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
  moveMessage: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  moveMessageText: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.handBold,
    fontSize: 15,
  },
  moveMessageDismiss: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 22,
    marginLeft: spacing.sm,
  },
  dragToolbar: {
    alignItems: 'center',
    bottom: 96,
    flexDirection: 'row',
    left: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'absolute',
    right: spacing.sm,
    zIndex: 50,
  },
  dragToolbarCopy: {
    flex: 1,
    minWidth: 0,
  },
  dragToolbarTitle: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 17,
  },
  dragToolbarTime: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 14,
    marginTop: 1,
  },
  dragCancelButton: {
    borderColor: colors.ink,
    borderRadius: 8,
    borderWidth: 1.5,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dragCancelText: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 14,
  },
  timeline: {
    position: 'relative',
    overflow: 'hidden',
  },
  dayAtmosphere: {
    left: 74,
    position: 'absolute',
    right: 0,
  },
  tomorrowRow: {
    alignItems: 'center',
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
    right: 0,
    transform: [{ translateY: -11 }],
    zIndex: 1,
  },
  tomorrowLabel: {
    backgroundColor: colors.aqua,
    borderColor: colors.ink,
    borderRadius: 8,
    borderWidth: 1.5,
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 12,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'center',
    width: 112,
  },
  tomorrowRule: {
    borderTopColor: colors.ink,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    flex: 1,
    marginLeft: 6,
    opacity: 0.55,
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
  dragPreview: {
    position: 'absolute',
    zIndex: 20,
  },
  dragPreviewBadge: {
    alignSelf: 'flex-end',
    backgroundColor: colors.lime,
    borderColor: colors.ink,
    borderRadius: 7,
    borderWidth: 1.5,
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 12,
    marginRight: 7,
    marginTop: -8,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  dragPreviewConflict: {
    backgroundColor: colors.pink,
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
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  recurringCard: {
    maxWidth: 420,
    padding: spacing.xl,
    width: '100%',
  },
  recurringTitle: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 27,
  },
  recurringBody: {
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 18,
    lineHeight: 25,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  recurringPrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  recurringPrimaryText: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 17,
  },
  recurringSecondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.aqua,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  recurringSecondaryText: {
    color: colors.ink,
    fontFamily: fonts.handBold,
    fontSize: 17,
  },
  modalCancel: {
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  modalCancelText: {
    color: colors.muted,
    fontFamily: fonts.handBold,
    fontSize: 15,
  },
});
