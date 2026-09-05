import { policy } from "../config/policy.js";
import { to24Hour } from "./slotTime.js";

/** Parses a "YYYY-MM-DD" string into a UTC-midnight Date, or throws. */
export const parseDateOnly = (value: string): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date: ${value}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
};

export const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const startOfTodayUtc = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** A booking date must be today or later, and no further than the configured lead window. */
export const isWithinBookingWindow = (date: Date, now = new Date()): boolean => {
  const today = startOfTodayUtc(now);
  const maxDate = new Date(today);
  maxDate.setUTCDate(maxDate.getUTCDate() + policy.maxBookingLeadDays);
  return date.getTime() >= today.getTime() && date.getTime() <= maxDate.getTime();
};

/** Combines a DATE-only value with a "h:mm AM/PM" or "HH:mm" slot time into one instant (UTC). */
export const combineDateAndTime = (date: Date, time: string): Date => {
  const time24 = /am|pm/i.test(time) ? to24Hour(time) : time;
  const [hourStr, minuteStr] = time24.split(":");
  const combined = new Date(date);
  combined.setUTCHours(Number(hourStr), Number(minuteStr), 0, 0);
  return combined;
};
