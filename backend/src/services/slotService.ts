import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { getActiveRestaurantOrThrow } from "./restaurantService.js";
import { ApiError } from "../utils/http.js";
import { formatDateOnly, isWithinBookingWindow, parseDateOnly } from "../utils/dates.js";
import { isValidTime12, to12Hour, to24Hour } from "../utils/slotTime.js";
import type { TablePreference } from "../../generated/prisma/enums.js";
import { TABLE_PREFERENCE_BY_LABEL } from "../constants/bookingOptions.js";

type PrismaTx = PrismaClient | Prisma.TransactionClient;

const mealLabel = (meal: "LUNCH" | "DINNER") => (meal === "LUNCH" ? "Lunch" : "Dinner");

/** Total people currently booked (UPCOMING only) for a restaurant/date/time — used both for
 * the read-only availability endpoint and, with a transaction client, for the authoritative
 * re-check performed at booking creation/modification time to close the race-condition window. */
export const getBookedSeatCount = async (
  client: PrismaTx,
  input: { restaurantId: string; date: Date; time: string; excludeBookingId?: string },
) => {
  const result = await client.restaurantBooking.aggregate({
    where: {
      restaurantId: input.restaurantId,
      date: input.date,
      time: input.time,
      status: "UPCOMING",
      ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
    },
    _sum: { people: true },
  });
  return result._sum.people ?? 0;
};

export const getAvailableSlots = async (restaurantId: string, dateStr: string, people: number, preferenceLabel?: string) => {
  const restaurant = await getActiveRestaurantOrThrow(restaurantId);

  let date: Date;
  try {
    date = parseDateOnly(dateStr);
  } catch {
    throw new ApiError(422, "Invalid date. Use YYYY-MM-DD format.");
  }
  if (!isWithinBookingWindow(date)) {
    throw new ApiError(422, "Date must be between today and 60 days from now.");
  }
  if (!Number.isInteger(people) || people < 1) {
    throw new ApiError(422, "people must be a positive integer.");
  }
  const preference = preferenceLabel ? TABLE_PREFERENCE_BY_LABEL[preferenceLabel] : "ANY";

  const [slotConfigs, seatsByTime, rawTables, rawBookedTables] = await Promise.all([
    prisma.slotConfiguration.findMany({
      where: { restaurantId, isActive: true },
      orderBy: [{ meal: "asc" }, { time: "asc" }],
    }),
    prisma.restaurantBooking.groupBy({
      by: ["time"],
      where: { restaurantId, date, status: "UPCOMING" },
      _sum: { people: true },
    }),
    prisma.diningTable.findMany({ where: { restaurantId, status: "ACTIVE" }, orderBy: [{ capacity: "asc" }, { name: "asc" }] }),
    prisma.restaurantBooking.findMany({
      where: { restaurantId, date, status: "UPCOMING", tableId: { not: null } },
      select: { time: true, tableId: true },
    }),
  ]);

  // Older callers and tests may not yet mock the newly introduced table queries.
  // Treat an absent result exactly like a restaurant with no configured tables so
  // the original capacity-based availability contract remains valid.
  const tables = rawTables ?? [];
  const bookedTables = rawBookedTables ?? [];

  const bookedByTime = new Map(seatsByTime.map((row) => [row.time, row._sum.people ?? 0]));

  const tableIdsByTime = new Map<string, Set<string>>();
  bookedTables.forEach(({ time, tableId }) => {
    if (!tableId) return;
    const ids = tableIdsByTime.get(time) ?? new Set<string>();
    ids.add(tableId);
    tableIdsByTime.set(time, ids);
  });
  const groupsByMeal = new Map<string, { label: string; slots: Array<Record<string, unknown>> }>();

  for (const slot of slotConfigs) {
    const booked = bookedByTime.get(slot.time) ?? 0;
    const seatsLeft = Math.max(restaurant.seatingCapacity - booked, 0);
    const freeTables = tables.filter((table) => table.capacity >= people && (preference === "ANY" || table.preference === preference) && !tableIdsByTime.get(slot.time)?.has(table.id));
    // Restaurants without configured physical tables keep the original capacity workflow.
    const available = tables.length ? freeTables.length > 0 : seatsLeft >= people;

    const rawSeatsLeft = tables.length ? freeTables.reduce((sum, table) => sum + table.capacity, 0) : seatsLeft;

    const group = groupsByMeal.get(slot.meal) ?? { label: mealLabel(slot.meal), slots: [] };
    group.slots.push({
      time: to12Hour(slot.time), available, seatsLeft: available ? rawSeatsLeft : undefined,
      availableTableCount: freeTables.length,
      ...(tables.length ? { availableTables: freeTables.map((table) => ({ id: table.id, name: table.name, capacity: table.capacity, preference: table.preference, section: table.section })) } : {}),
    });
    groupsByMeal.set(slot.meal, group);
  }

  return {
    date: formatDateOnly(date),
    groups: Array.from(groupsByMeal.values()),
    maxPeople: restaurant.maxPartySize,
  };
};

/** Admin-facing check: which physical tables are free for a specific date/time/party size,
 * independent of the slot grid (useful for walk-ins or manual booking assignment). */
export const getTableAvailability = async (restaurantId: string, dateStr: string, time12: string, people: number, preferenceLabel?: string) => {
  await getActiveRestaurantOrThrow(restaurantId);

  let date: Date;
  try {
    date = parseDateOnly(dateStr);
  } catch {
    throw new ApiError(422, "Invalid date. Use YYYY-MM-DD format.");
  }
  if (!isWithinBookingWindow(date)) {
    throw new ApiError(422, "Date must be between today and 60 days from now.");
  }
  if (!isValidTime12(time12)) {
    throw new ApiError(422, 'Invalid time format. Use e.g. "12:00 PM".');
  }
  if (!Number.isInteger(people) || people < 1) {
    throw new ApiError(422, "people must be a positive integer.");
  }
  const time = to24Hour(time12);
  const preference = preferenceLabel ? TABLE_PREFERENCE_BY_LABEL[preferenceLabel] : "ANY";

  const [tables, bookedTables] = await Promise.all([
    prisma.diningTable.findMany({ where: { restaurantId, status: "ACTIVE" }, orderBy: [{ capacity: "asc" }, { name: "asc" }] }),
    prisma.restaurantBooking.findMany({
      where: { restaurantId, date, time, status: "UPCOMING", tableId: { not: null } },
      select: { tableId: true },
    }),
  ]);

  const bookedIds = new Set(bookedTables.map((booking) => booking.tableId));
  const eligibleTables = tables.filter((table) => table.capacity >= people && (preference === "ANY" || table.preference === preference));
  const availableTables = eligibleTables.filter((table) => !bookedIds.has(table.id));

  return {
    date: formatDateOnly(date),
    time: to12Hour(time),
    people,
    hasTables: tables.length > 0,
    availableCount: availableTables.length,
    tables: availableTables.map((table) => ({ id: table.id, name: table.name, capacity: table.capacity, preference: table.preference, section: table.section })),
  };
};

/** Finds a free, smallest-capacity table. Called inside the booking transaction. */
export const findAvailableTable = async (
  client: PrismaTx,
  input: { restaurantId: string; date: Date; time: string; people: number; preference: TablePreference; tableId?: string; excludeBookingId?: string },
) => {
  const tables = (await client.diningTable.findMany({
    where: {
      restaurantId: input.restaurantId,
      status: "ACTIVE",
      capacity: { gte: input.people },
      ...(input.tableId ? { id: input.tableId } : {}),
      ...(input.preference !== "ANY" ? { preference: input.preference } : {}),
    },
    orderBy: [{ capacity: "asc" }, { name: "asc" }],
  })) ?? [];
  if (!tables.length) {
    const tableCount = (await client.diningTable.count({ where: { restaurantId: input.restaurantId } })) ?? 0;
    return { hasTables: tableCount > 0, table: null };
  }
  const busy = (await client.restaurantBooking.findMany({
    where: { restaurantId: input.restaurantId, date: input.date, time: input.time, status: "UPCOMING", tableId: { not: null }, ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}) },
    select: { tableId: true },
  })) ?? [];
  const busyIds = new Set(busy.map((booking) => booking.tableId));
  return { hasTables: true, table: tables.find((table) => !busyIds.has(table.id)) ?? null };
};
