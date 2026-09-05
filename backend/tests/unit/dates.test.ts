import { describe, expect, it } from "vitest";
import { combineDateAndTime, formatDateOnly, isWithinBookingWindow, parseDateOnly } from "../../src/utils/dates.js";

describe("parseDateOnly / formatDateOnly", () => {
  it("round-trips a valid date", () => {
    expect(formatDateOnly(parseDateOnly("2026-08-25"))).toBe("2026-08-25");
  });

  it("throws on malformed input", () => {
    expect(() => parseDateOnly("25-08-2026")).toThrow();
    expect(() => parseDateOnly("not-a-date")).toThrow();
  });
});

describe("isWithinBookingWindow", () => {
  const now = new Date("2026-08-22T10:00:00.000Z");

  it("accepts today", () => {
    expect(isWithinBookingWindow(parseDateOnly("2026-08-22"), now)).toBe(true);
  });

  it("accepts exactly 60 days out", () => {
    expect(isWithinBookingWindow(parseDateOnly("2026-10-21"), now)).toBe(true);
  });

  it("rejects 61 days out", () => {
    expect(isWithinBookingWindow(parseDateOnly("2026-10-22"), now)).toBe(false);
  });

  it("rejects a past date", () => {
    expect(isWithinBookingWindow(parseDateOnly("2026-08-21"), now)).toBe(false);
  });
});

describe("combineDateAndTime", () => {
  it("combines a date-only value with a 12h slot time", () => {
    const combined = combineDateAndTime(parseDateOnly("2026-08-25"), "12:30 PM");
    expect(combined.getUTCHours()).toBe(12);
    expect(combined.getUTCMinutes()).toBe(30);
    expect(combined.getUTCDate()).toBe(25);
  });

  it("combines a date-only value with a 24h slot time", () => {
    const combined = combineDateAndTime(parseDateOnly("2026-08-25"), "19:00");
    expect(combined.getUTCHours()).toBe(19);
  });
});
