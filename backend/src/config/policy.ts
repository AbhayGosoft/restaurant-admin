import { env } from "./env.js";

/**
 * Centralized, explicit business rules the spec left for the backend to decide.
 * Keep every modification/cancellation/refund decision routed through this file
 * instead of scattering magic numbers across controllers.
 */
export const policy = {
  /** Minutes before a booking's slot time after which it can no longer be modified. */
  modificationCutoffMinutes: env.bookingModificationCutoffMinutes,
  /** Minutes before a booking's slot time to fire the reminder push. */
  reminderMinutesBefore: env.bookingReminderMinutesBefore,
  /** Fixed advance amount (INR) charged for every restaurant booking. */
  bookingAdvanceInr: env.restaurantBookingAdvanceInr,
  /** Furthest a customer may book ahead. */
  maxBookingLeadDays: 60,
};

export type RefundDecision = { eligible: boolean; amount: number };

/**
 * Refund policy: full refund of the advance if cancelled more than the
 * modification cutoff before the booked slot; no refund otherwise. This is an
 * explicit initial assumption (documented in README) — change here only.
 */
export const decideRefund = (input: { advancePaid: number; slotDateTime: Date; now?: Date }): RefundDecision => {
  const now = input.now ?? new Date();
  const minutesUntilSlot = (input.slotDateTime.getTime() - now.getTime()) / 60_000;
  const eligible = minutesUntilSlot >= policy.modificationCutoffMinutes;
  return { eligible, amount: eligible ? input.advancePaid : 0 };
};
