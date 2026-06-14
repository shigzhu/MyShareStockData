const closedRanges2026: Array<[string, string]> = [
  ["2026-01-01", "2026-01-03"],
  ["2026-02-15", "2026-02-23"],
  ["2026-04-04", "2026-04-06"],
  ["2026-05-01", "2026-05-05"],
  ["2026-06-19", "2026-06-21"],
  ["2026-09-25", "2026-09-27"],
  ["2026-10-01", "2026-10-07"]
];

export interface BeijingClock {
  date: string;
  hours: number;
  minutes: number;
  seconds: number;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getBeijingClock(date: Date): BeijingClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const valueOf = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const year = valueOf("year");
  const month = valueOf("month");
  const day = valueOf("day");

  return {
    date: `${year}-${month}-${day}`,
    hours: Number(valueOf("hour")),
    minutes: Number(valueOf("minute")),
    seconds: Number(valueOf("second"))
  };
}

export function formatBeijingDate(date: Date): string {
  return getBeijingClock(date).date;
}

export function formatBeijingDateTime(date: Date): string {
  const clock = getBeijingClock(date);
  const hours = String(clock.hours).padStart(2, "0");
  const minutes = String(clock.minutes).padStart(2, "0");
  const seconds = String(clock.seconds).padStart(2, "0");
  return `${clock.date}T${hours}:${minutes}:${seconds}`;
}

function isInClosedRange(date: string) {
  return closedRanges2026.some(([start, end]) => date >= start && date <= end);
}

export function isAshareTradingDay(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = localDate.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  return !isInClosedRange(date);
}
