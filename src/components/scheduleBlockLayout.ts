export type ScheduleBlockDensity = 'tiny' | 'compact' | 'standard' | 'large';

export type ScheduleBlockDimensions = {
  height: number;
  width: number;
};

const MIN_TEXT_HEIGHT = 24;
const MIN_TEXT_WIDTH = 48;
const MIN_STANDARD_HEIGHT = 50;
const MIN_STANDARD_WIDTH = 100;
const MIN_LARGE_HEIGHT = 84;
const MIN_LARGE_WIDTH = 180;

export function getScheduleBlockDensity({
  height,
  width,
}: ScheduleBlockDimensions): ScheduleBlockDensity {
  if (height < MIN_TEXT_HEIGHT || width < MIN_TEXT_WIDTH) return 'tiny';
  if (height < MIN_STANDARD_HEIGHT || width < MIN_STANDARD_WIDTH) return 'compact';
  if (height < MIN_LARGE_HEIGHT || width < MIN_LARGE_WIDTH) return 'standard';
  return 'large';
}
