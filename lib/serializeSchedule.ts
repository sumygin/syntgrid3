export interface ScheduleCalendarEvent {
  title: string;
  startTime: Date | string;
  endTime: Date | string;
}

export interface ScheduleCustomEvent {
  title: string;
  startTime: Date | string;
  endTime: Date | string;
}

function formatTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Schedule event contains an invalid date.");
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function formatEvent(event: ScheduleCalendarEvent | ScheduleCustomEvent): string {
  return `${formatTime(event.startTime)} to ${formatTime(event.endTime)} - ${event.title.trim() || "Untitled event"}`;
}

export function serializeSchedule(
  weekStartIso: string,
  readOnlyEvents: ScheduleCalendarEvent[],
  customEvents: ScheduleCustomEvent[]
): string {
  const weekStart = new Date(weekStartIso);
  if (Number.isNaN(weekStart.getTime())) throw new Error("The schedule week must have a valid start date.");
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const events = [...readOnlyEvents, ...customEvents]
    .filter((event) => {
      const start = new Date(event.startTime).getTime();
      const end = new Date(event.endTime).getTime();
      return Number.isFinite(start) && Number.isFinite(end) && start < weekEnd.getTime() && end > weekStart.getTime();
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return events.length > 0
    ? events.map(formatEvent).join("\n")
    : "No occupied time slots in this week.";
}
