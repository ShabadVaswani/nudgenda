export const BASE_HOUR_HEIGHT = 92;
export const MAX_HOUR_HEIGHT = 180;
export const MIN_VISUAL_EVENT_MINUTES = 10;
export const TARGET_SMALLEST_BLOCK_HEIGHT = 30;

export type TimelineInterval = {
  endMinute: number;
  startMinute: number;
};

export type TimelineLane = {
  lane: number;
  laneCount: number;
  visualEndMinute: number;
};

export function getVisualEventDuration(durationMinutes: number) {
  return Math.max(MIN_VISUAL_EVENT_MINUTES, durationMinutes);
}

export function getAdaptiveHourHeight(durations: number[]) {
  const shortestDuration = durations.reduce(
    (shortest, duration) =>
      duration > 0 ? Math.min(shortest, getVisualEventDuration(duration)) : shortest,
    Number.POSITIVE_INFINITY,
  );

  if (!Number.isFinite(shortestDuration)) return BASE_HOUR_HEIGHT;

  const heightNeededForSmallestBlock =
    (TARGET_SMALLEST_BLOCK_HEIGHT / shortestDuration) * 60;
  return Math.min(MAX_HOUR_HEIGHT, Math.max(BASE_HOUR_HEIGHT, heightNeededForSmallestBlock));
}

export function assignTimelineLanes<T extends TimelineInterval>(items: T[]): (T & TimelineLane)[] {
  const laidOut = items.map((item) => ({
    ...item,
    lane: 0,
    laneCount: 1,
    visualEndMinute: item.startMinute + getVisualEventDuration(item.endMinute - item.startMinute),
  }));

  for (let clusterStart = 0; clusterStart < laidOut.length; ) {
    let clusterEnd = clusterStart + 1;
    let latestVisualEnd = laidOut[clusterStart].visualEndMinute;
    while (
      clusterEnd < laidOut.length &&
      laidOut[clusterEnd].startMinute < latestVisualEnd - 0.01
    ) {
      latestVisualEnd = Math.max(latestVisualEnd, laidOut[clusterEnd].visualEndMinute);
      clusterEnd += 1;
    }

    const laneEnds: number[] = [];
    for (let index = clusterStart; index < clusterEnd; index += 1) {
      const item = laidOut[index];
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.startMinute + 0.01);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.visualEndMinute;
      item.lane = lane;
    }
    for (let index = clusterStart; index < clusterEnd; index += 1) {
      laidOut[index].laneCount = laneEnds.length;
    }
    clusterStart = clusterEnd;
  }

  return laidOut;
}
