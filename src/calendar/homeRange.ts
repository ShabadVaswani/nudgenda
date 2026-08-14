export const TOMORROW_REVEAL_HOUR = 18;

export function shouldShowTomorrow(value: Date) {
  return value.getHours() >= TOMORROW_REVEAL_HOUR;
}

export function nextLocalDay(value: Date) {
  const next = new Date(value);
  next.setDate(value.getDate() + 1);
  return next;
}

function localDayNumber(value: Date) {
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
}

export function minuteFromLocalDay(value: Date, referenceDay: Date) {
  const dayOffset = Math.round(
    (localDayNumber(value) - localDayNumber(referenceDay)) / 86_400_000,
  );
  return (
    dayOffset * 1440 + value.getHours() * 60 + value.getMinutes() + value.getSeconds() / 60
  );
}
