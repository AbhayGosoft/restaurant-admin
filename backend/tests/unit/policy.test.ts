import { describe, expect, it } from "vitest";
import { decideRefund, policy } from "../../src/config/policy.js";

describe("decideRefund", () => {
  const now = new Date("2026-08-22T10:00:00.000Z");

  it("grants a full refund when cancelled well before the cutoff", () => {
    const slotDateTime = new Date(now.getTime() + (policy.modificationCutoffMinutes + 120) * 60_000);
    const result = decideRefund({ advancePaid: 99, slotDateTime, now });
    expect(result).toEqual({ eligible: true, amount: 99 });
  });

  it("denies a refund when cancelled inside the cutoff window", () => {
    const slotDateTime = new Date(now.getTime() + (policy.modificationCutoffMinutes - 10) * 60_000);
    const result = decideRefund({ advancePaid: 99, slotDateTime, now });
    expect(result).toEqual({ eligible: false, amount: 0 });
  });

  it("treats exactly-at-cutoff as eligible (inclusive boundary)", () => {
    const slotDateTime = new Date(now.getTime() + policy.modificationCutoffMinutes * 60_000);
    const result = decideRefund({ advancePaid: 99, slotDateTime, now });
    expect(result.eligible).toBe(true);
  });
});
