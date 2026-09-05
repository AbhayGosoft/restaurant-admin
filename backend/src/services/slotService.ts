import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { getActiveRestaurantOrThrow } from "./restaurantService.js";
import { ApiError } from "../utils/http.js";
import { formatDateOnly, isWithinBookingWindow, parseDateOnly } from "../utils/dates.js";
import { to12Hour } from "../utils/slotTime.js";

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

export const getAvailableSlots = async (restaurantId: string, dateStr: string, people: number) => {
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

  const [slotConfigs, seatsByTime] = await Promise.all([
    prisma.slotConfiguration.findMany({
      where: { restaurantId, isActive: true },
      orderBy: [{ meal: "asc" }, { time: "asc" }],
    }),
    prisma.restaurantBooking.groupBy({
      by: ["time"],
      where: { restaurantId, date, status: "UPCOMING" },
      _sum: { people: true },
    }),
  ]);

  const bookedByTime = new Map(seatsByTime.map((row) => [row.time, row._sum.people ?? 0]));

  const groupsByMeal = new Map<string, { label: string; slots: Array<{ time: string; available: boolean; seatsLeft?: number }> }>();

  for (const slot of slotConfigs) {
    const booked = bookedByTime.get(slot.time) ?? 0;
    const seatsLeft = Math.max(restaurant.seatingCapacity - booked, 0);
    const available = seatsLeft >= people;

    const group = groupsByMeal.get(slot.meal) ?? { label: mealLabel(slot.meal), slots: [] };
    group.slots.push({ time: to12Hour(slot.time), available, ...(available ? { seatsLeft } : {}) });
    groupsByMeal.set(slot.meal, group);
  }

  return {
    date: formatDateOnly(date),
    groups: Array.from(groupsByMeal.values()),
    maxPeople: restaurant.maxPartySize,
  };
};
