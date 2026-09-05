import { describe, expect, it } from "vitest";
import { generateHumanBookingId } from "../../src/utils/bookingId.js";

describe("generateHumanBookingId", () => {
  it("derives initials from the restaurant name and starts with #", () => {
    const id = generateHumanBookingId("Shree Shyam Restaurant", new Date("2026-08-22T00:00:00.000Z"));
    expect(id.startsWith("#SSR")).toBe(true);
    expect(id).toMatch(/^#SSR2608221\d{3}$|^#SSR2608229\d{2}$|^#SSR260822\d{4}$/);
  });

  it("falls back to RB for an empty/whitespace name", () => {
    expect(generateHumanBookingId("   ")).toMatch(/^#RB/);
  });

  it("produces different ids across calls (random suffix)", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateHumanBookingId("Annapurna Pure Veg")));
    expect(ids.size).toBeGreaterThan(1);
  });
});
