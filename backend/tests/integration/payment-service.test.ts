import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/prisma.js", async () => {
  const { createMockPrisma } = await import("../helpers/mockPrisma.js");
  return { prisma: createMockPrisma() };
});

vi.mock("../../src/lib/razorpay.js", () => ({
  createRazorpayOrder: vi.fn(async (input: { amountPaise: number }) => ({ id: "order_mock_1", amount: input.amountPaise, currency: "INR", mock: true })),
  verifyRazorpaySignature: vi.fn(),
}));

let prisma: any;
let verifyRazorpaySignature: any;
let initiatePayment: typeof import("../../src/services/paymentService.js").initiatePayment;
let verifyPayment: typeof import("../../src/services/paymentService.js").verifyPayment;

beforeAll(async () => {
  ({ prisma } = await import("../../src/lib/prisma.js"));
  ({ verifyRazorpaySignature } = await import("../../src/lib/razorpay.js"));
  ({ initiatePayment, verifyPayment } = await import("../../src/services/paymentService.js"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("initiatePayment", () => {
  const restaurant = { id: "r1", status: "ACTIVE" };

  it("charges the DB total of the selected menu items", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restaurant);
    prisma.menuItem.findMany.mockResolvedValue([
      { id: "item-1", price: "120.00" },
      { id: "item-2", price: "35.50" },
    ]);
    prisma.payment.create.mockResolvedValue({ id: "payment-1" });
    const order = await initiatePayment("customer-A", {
      restaurantId: "r1",
      items: [
        { menuItemId: "item-1", quantity: 2 },
        { menuItemId: "item-2", quantity: 1 },
      ],
    });
    expect(order.amount).toBe(275.5);
    expect(order.currency).toBe("INR");
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 275.5, currency: "INR", status: "CREATED" }) }),
    );
  });

  it("rejects when a selected item is unavailable", async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restaurant);
    prisma.menuItem.findMany.mockResolvedValue([]);
    await expect(initiatePayment("customer-A", { restaurantId: "r1", items: [{ menuItemId: "item-1", quantity: 1 }] })).rejects.toThrow(/unavailable/i);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});

describe("verifyPayment", () => {
  const input = { razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "sig_1" };

  it("rejects when the order doesn't belong to the caller", async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: "payment-1", restaurantUserId: "someone-else", status: "CREATED" });
    await expect(verifyPayment("customer-A", input)).rejects.toThrow(/not found/i);
  });

  it("rejects a duplicate verification of an already-verified payment", async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: "payment-1", restaurantUserId: "customer-A", status: "VERIFIED" });
    await expect(verifyPayment("customer-A", input)).rejects.toThrow(/already been verified/i);
  });

  it("marks the payment FAILED and rejects on an invalid signature", async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: "payment-1", restaurantUserId: "customer-A", status: "CREATED" });
    verifyRazorpaySignature.mockReturnValue(false);

    await expect(verifyPayment("customer-A", input)).rejects.toThrow(/invalid payment signature/i);
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "FAILED" } }));
  });

  it("marks the payment VERIFIED on a valid signature", async () => {
    prisma.payment.findUnique.mockResolvedValue({ id: "payment-1", restaurantUserId: "customer-A", status: "CREATED" });
    verifyRazorpaySignature.mockReturnValue(true);
    prisma.payment.update.mockResolvedValue({ id: "payment-1", razorpayOrderId: "order_1", amount: "99", currency: "INR", status: "VERIFIED" });

    const result = await verifyPayment("customer-A", input);
    expect(result.status).toBe("VERIFIED");
  });
});
