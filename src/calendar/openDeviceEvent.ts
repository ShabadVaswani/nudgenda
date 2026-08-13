type OpenableCalendarEvent = {
  openInCalendar(options: object): Promise<unknown>;
};

type LoadCalendarEvent = (eventId: string) => Promise<OpenableCalendarEvent>;

export async function openDeviceCalendarEvent(eventId: string, loadEvent: LoadCalendarEvent) {
  try {
    const event = await loadEvent(eventId);
    await event.openInCalendar({});
  } catch {
    throw new Error(
      'This event could not be opened. It may have been removed, or no calendar app is available.',
    );
  }
}
