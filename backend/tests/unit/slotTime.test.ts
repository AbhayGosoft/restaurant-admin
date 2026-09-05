import { describe, expect, it } from "vitest";
import { isValidTime12, to12Hour, to24Hour } from "../../src/utils/slotTime.js";

describe("slot time conversion", () => {
  it("converts 24h to 12h correctly across noon/midnight boundaries", () => {
    expect(to12Hour("00:00")).toBe("12:00 AM");
    expect(to12Hour("12:00")).toBe("12:00 PM");
    expect(to12Hour("11:30")).toBe("11:30 AM");
    expect(to12Hour("13:00")).toBe("1:00 PM");
    expect(to12Hour("23:45")).toBe("11:45 PM");
  });

  it("converts 12h to 24h correctly", () => {
    expect(to24Hour("12:00 AM")).toBe("00:00");
    expect(to24Hour("12:00 PM")).toBe("12:00");
    expect(to24Hour("1:00 PM")).toBe("13:00");
    expect(to24Hour("11:30 am")).toBe("11:30");
  });

  it("round-trips", () => {
    for (const time of ["11:00 AM", "12:30 PM", "7:00 PM", "9:00 PM"]) {
      expect(to12Hour(to24Hour(time))).toBe(time);
    }
  });

  it("validates 12h time format", () => {
    expect(isValidTime12("12:00 PM")).toBe(true);
    expect(isValidTime12("9:05 am")).toBe(true);
    expect(isValidTime12("25:00 PM")).toBe(true); // regex only checks shape, not range
    expect(isValidTime12("noon")).toBe(false);
    expect(isValidTime12("12:00")).toBe(false);
  });

  it("throws on invalid 12h input", () => {
    expect(() => to24Hour("not-a-time")).toThrow();
  });
});
