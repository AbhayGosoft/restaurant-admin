import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/prisma.js", async () => {
  const { createMockPrisma } = await import("../helpers/mockPrisma.js");
  return { prisma: createMockPrisma() };
});

vi.mock("../../src/queues/reminderQueue.js", () => ({
  scheduleReminder: vi.fn(async () => "job-1"),
  cancelReminder: vi.fn(async () => undefined),
  closeQueues: vi.fn(async () => undefined),
}));

let prisma: any;
let createBooking: typeof import("../../src/services/bookingService.js").createBooking;
let modifyBooking: typeof import("../../src/services/bookingService.js").modifyBooking;
let cancelBooking: typeof import("../../src/services/bookingService.js").cancelBooking;

const addDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const FUTURE_DATE = addDays(5);

const activeRestaurant = {
  id: "r1",
  name: "Shree Shyam Restaurant",
  status: "ACTIVE",
  banner: null,
  rating: "4.6",
  cuisineLabel: "Pure Veg",
  latitude: "23.0",
  longitude: "72.5",
  seatingCapacity: 40,
  maxPartySize: 12,
};

const baseBooking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking-1",
  humanBookingId: "#SSR260615123",
  restaurantId: "r1",
  restaurantUserId: "customer-A",
  restaurantNameSnapshot: "Shree Shyam Restaurant",
  restaurantImageSnapshot: null,
  ratingSnapshot: "4.6",
  cuisineLabelSnapshot: "Pure Veg",
  distanceKmSnapshot: null,
  date: new Date(`${FUTURE_DATE}T00:00:00.000Z`),
  time: "12:00",
  people: 4,
  tablePreference: "ANY",
  specialRequest: null,
  fullName: "Rahul Sharma",
  mobileNumber: "+919876543210",
  email: null,
  status: "UPCOMING",
  cancellationReason: null,
  cancelledAt: null,
  advancePaid: "99",
  paymentId: "payment-1",
  refundEligible: null,
  refundAmount: null,
  reminderJobId: null,
  ...overrides,
});

beforeAll(async () => {
  ({ prisma } = await import("../../src/lib/prisma.js"));
  ({ createBooking, modifyBooking, cancelBooking } = await import("../../src/services/bookingService.js"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createBooking", () => {
  const validInput = {
    date: FUTURE_DATE,
    time: "12:00 PM",
    people: 4,
    tablePreference: "Any Table",
    fullName: "Rahul Sharma",
    mobileNumber: "+919876543210",
    razorpayOrderId: "order_1",
    razorpayPaymentId: "pay_1",
  };

  const mockHappyPath = () => {
    prisma.restaurant.findUnique.mockResolvedValue(activeRestaurant);
    prisma.slotConfiguration.findFirst.mockResolvedValue({ id: "slot-1", time: "12:00" });
    prisma.payment.findUnique.mockResolvedValue({
      id: "payment-1",
      restaurantUserId: "customer-A",
      status: "VERIFIED",
      razorpayPaymentId: "pay_1",
      amount: "99",
    });
    prisma.restaurantBooking.findUnique.mockResolvedValue(null);
    prisma.restaurantBooking.aggregate.mockResolvedValue({ _sum: { people: 0 } });
    prisma.restaurantBooking.create.mockResolvedValue(baseBooking());
    prisma.restaurantBooking.update.mockResolvedValue(baseBooking());
  };

  it("rejects a date more than 60 days out", async () => {
    mockHappyPath();
    await expect(createBooking("customer-A", "r1", { ...validInput, date: addDays(90) })).rejects.toThrow(/60 days/);
  });

  it("rejects when the payment has not been verified", async () => {
    mockHappyPath();
    prisma.payment.findUnique.mockResolvedValue({ id: "payment-1", restaurantUserId: "customer-A", status: "CREATED", razorpayPaymentId: "pay_1", amount: "99" });
    await expect(createBooking("customer-A", "r1", validInput)).rejects.toThrow(/not been verified/);
  });

  it("rejects when party size exceeds the restaurant's max party size", async () => {
    mockHappyPath();
    await expect(createBooking("customer-A", "r1", { ...validInput, people: 99 })).rejects.toThrow(/people must be between/);
  });

  it("rejects when the slot no longer has enough capacity (race-condition guard)", async () => {
    mockHappyPath();
    prisma.restaurantBooking.aggregate.mockResolvedValue({ _sum: { people: 38 } }); // only 2 seats left, need 4
    await expect(createBooking("customer-A", "r1", validInput)).rejects.toThrow(/capacity/);
  });

  it("rejects reusing a payment that already funded a different booking", async () => {
    mockHappyPath();
    prisma.restaurantBooking.findUnique.mockResolvedValue(baseBooking({ id: "other-booking" }));
    await expect(createBooking("customer-A", "r1", validInput)).rejects.toThrow(/already been used/);
  });

  it("creates a booking and returns it with status \"upcoming\"", async () => {
    mockHappyPath();
    const result = await createBooking("customer-A", "r1", validInput);
    expect(result.status).toBe("upcoming");
    expect(result.advancePaid).toBe(99);
    expect(result.tablePreference).toBe("Any Table");
    expect(prisma.restaurantBooking.create).toHaveBeenCalled();
  });
});

describe("modifyBooking", () => {
  it("rejects modification once inside the cutoff window", async () => {
    const soon = new Date(Date.now() + 30 * 60_000); // 30 minutes from now, cutoff default is 60
    prisma.restaurantBooking.findUnique.mockResolvedValue(
      baseBooking({ date: new Date(Date.UTC(soon.getUTCFullYear(), soon.getUTCMonth(), soon.getUTCDate())), time: `${soon.getUTCHours().toString().padStart(2, "0")}:${soon.getUTCMinutes().toString().padStart(2, "0")}` }),
    );
    await expect(modifyBooking("customer-A", "booking-1", { people: 2 })).rejects.toThrow(/cutoff|modified/i);
  });

  it("rejects modifying a cancelled booking", async () => {
    prisma.restaurantBooking.findUnique.mockResolvedValue(baseBooking({ status: "CANCELLED" }));
    await expect(modifyBooking("customer-A", "booking-1", { people: 2 })).rejects.toThrow(/cancelled/i);
  });

  it("rejects a different customer modifying someone else's booking", async () => {
    prisma.restaurantBooking.findUnique.mockResolvedValue(baseBooking({ restaurantUserId: "customer-B" }));
    await expect(modifyBooking("customer-A", "booking-1", { people: 2 })).rejects.toThrow(/access/i);
  });

  it("rejects moving to a time with no matching slot configuration", async () => {
    prisma.restaurantBooking.findUnique.mockResolvedValue(baseBooking());
    prisma.restaurant.findUnique.mockResolvedValue(activeRestaurant);
    prisma.slotConfiguration.findFirst.mockResolvedValue(null);
    await expect(modifyBooking("customer-A", "booking-1", { time: "3:00 AM" })).rejects.toThrow(/not available/i);
  });
});

describe("cancelBooking", () => {
  it("rejects cancelling an already-cancelled booking", async () => {
    prisma.restaurantBooking.findUnique.mockResolvedValue(baseBooking({ status: "CANCELLED" }));
    await expect(cancelBooking("customer-A", "booking-1", "Change of plans")).rejects.toThrow(/already cancelled/i);
  });

  it("rejects cancelling a past booking", async () => {
    prisma.restaurantBooking.findUnique.mockResolvedValue(baseBooking({ date: new Date("2020-01-01T00:00:00.000Z"), time: "12:00" }));
    await expect(cancelBooking("customer-A", "booking-1", "Change of plans")).rejects.toThrow(/past/i);
  });

  it("rejects an invalid cancellation reason", async () => {
    prisma.restaurantBooking.findUnique.mockResolvedValue(baseBooking());
    await expect(cancelBooking("customer-A", "booking-1", "Not a real reason")).rejects.toThrow(/invalid/i);
  });

  it("grants a refund when cancelled well outside the modification cutoff", async () => {
    prisma.restaurantBooking.findUnique.mockResolvedValue(baseBooking());
    prisma.restaurantBooking.update.mockImplementation((args: any) => baseBooking({ ...args.data }));
    const result = await cancelBooking("customer-A", "booking-1", "Change of plans");
    expect(result.refund.eligible).toBe(true);
    expect(result.refund.amount).toBe(99);
  });
});
