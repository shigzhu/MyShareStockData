const closedRanges2026: Array<[string, string]> = [
  ["2026-01-01", "2026-01-03"],
  ["2026-02-15", "2026-02-23"],
  ["2026-04-04", "2026-04-06"],
  ["2026-05-01", "2026-05-05"],
  ["2026-06-19", "2026-06-21"],
  ["2026-09-25", "2026-09-27"],
  ["2026-10-01", "2026-10-07"]
];

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
