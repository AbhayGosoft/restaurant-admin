import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/prisma.js", async () => {
  const { createMockPrisma } = await import("../helpers/mockPrisma.js");
  return { prisma: createMockPrisma() };
});

let prisma: any;
let getAvailableSlots: typeof import("../../src/services/slotService.js").getAvailableSlots;

const activeRestaurant = { id: "r1", status: "ACTIVE", seatingCapacity: 10, maxPartySize: 12 };

beforeAll(async () => {
  ({ prisma } = await import("../../src/lib/prisma.js"));
  ({ getAvailableSlots } = await import("../../src/services/slotService.js"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getAvailableSlots", () => {
  it("rejects a malformed date", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(activeRestaurant);
    await expect(getAvailableSlots("r1", "not-a-date", 2)).rejects.toThrow(/invalid date/i);
  });

  it("rejects a date more than 60 days out", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(activeRestaurant);
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 90);
    await expect(getAvailableSlots("r1", farFuture.toISOString().slice(0, 10), 2)).rejects.toThrow(/60 days/);
  });

  it("marks a slot unavailable once capacity is exhausted for the requested party size", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(activeRestaurant);
    prisma.slotConfiguration.findMany.mockResolvedValue([
      { id: "s1", meal: "LUNCH", time: "12:00", sortOrder: 0, isActive: true },
      { id: "s2", meal: "LUNCH", time: "12:30", sortOrder: 1, isActive: true },
    ]);
    prisma.restaurantBooking.groupBy.mockResolvedValue([{ time: "12:00", _sum: { people: 9 } }]);

    const today = new Date().toISOString().slice(0, 10);
    const result = await getAvailableSlots("r1", today, 2);

    const lunch = result.groups.find((g: any) => g.label === "Lunch");
    const slot1200 = lunch.slots.find((s: any) => s.time === "12:00 PM");
    const slot1230 = lunch.slots.find((s: any) => s.time === "12:30 PM");

    expect(slot1200.available).toBe(false); // 10 - 9 = 1 seat left, need 2
    expect(slot1200.seatsLeft).toBeUndefined();
    expect(slot1230.available).toBe(true); // no bookings yet, 10 seats left
    expect(slot1230.seatsLeft).toBe(10);
  });

  it("groups slots by meal label and reports maxPeople from the restaurant", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(activeRestaurant);
    prisma.slotConfiguration.findMany.mockResolvedValue([
      { id: "s1", meal: "LUNCH", time: "12:00", sortOrder: 0, isActive: true },
      { id: "s2", meal: "DINNER", time: "19:00", sortOrder: 0, isActive: true },
    ]);
    prisma.restaurantBooking.groupBy.mockResolvedValue([]);

    const today = new Date().toISOString().slice(0, 10);
    const result = await getAvailableSlots("r1", today, 1);

    expect(result.groups.map((g: any) => g.label).sort()).toEqual(["Dinner", "Lunch"]);
    expect(result.maxPeople).toBe(12);
  });
});
