export type ScheduleItem = {
  id: string;
  title: string;
  startLabel: string;
  endLabel: string;
  color: string;
  symbol: string;
  dateLabel: string;
  description?: string[];
  calendarName: string;
  reminderLabel?: string;
  htmlLink?: string;
  canModify: boolean;
  isRecurring: boolean;
};
