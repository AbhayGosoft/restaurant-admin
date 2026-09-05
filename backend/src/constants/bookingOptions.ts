import type { CancellationReason, TablePreference } from "../../generated/prisma/enums.js";

export const TABLE_PREFERENCE_LABELS: Record<TablePreference, string> = {
  ANY: "Any Table",
  WINDOW: "Window Seat",
  INDOOR: "Indoor Seat",
  OUTDOOR: "Outdoor Seat",
};

export const TABLE_PREFERENCE_BY_LABEL: Record<string, TablePreference> = Object.fromEntries(
  Object.entries(TABLE_PREFERENCE_LABELS).map(([key, label]) => [label, key as TablePreference]),
);

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  CHANGE_OF_PLANS: "Change of plans",
  BOOKED_BY_MISTAKE: "Booked by mistake",
  FOUND_BETTER_OPTION: "Found a better option",
  RESTAURANT_NOT_RESPONDING: "Restaurant not responding",
  OTHER: "Other",
};

export const CANCELLATION_REASON_BY_LABEL: Record<string, CancellationReason> = Object.fromEntries(
  Object.entries(CANCELLATION_REASON_LABELS).map(([key, label]) => [label, key as CancellationReason]),
);
