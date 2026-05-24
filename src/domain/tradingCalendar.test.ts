import { describe, expect, it } from "vitest";
import { formatLocalDate, isAshareTradingDay } from "./tradingCalendar";

describe("tradingCalendar", () => {
  it("treats weekends as closed", () => {
    expect(isAshareTradingDay("2026-05-24")).toBe(false);
  });

  it("treats exchange holidays as closed", () => {
    expect(isAshareTradingDay("2026-05-01")).toBe(false);
  });

  it("allows normal weekdays outside holiday ranges", () => {
    expect(isAshareTradingDay("2026-05-21")).toBe(true);
  });

  it("formats a phone-local date without shifting to UTC", () => {
    expect(formatLocalDate(new Date(2026, 4, 24, 0, 16))).toBe("2026-05-24");
  });
});
