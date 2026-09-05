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
  it("always charges the server-configured advance amount, ignoring any client input", async () => {
    prisma.payment.create.mockResolvedValue({ id: "payment-1" });
    const order = await initiatePayment("customer-A");
    expect(order.amount).toBe(99); // RESTAURANT_BOOKING_ADVANCE_INR from .env
    expect(order.currency).toBe("INR");
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 99, currency: "INR", status: "CREATED" }) }),
    );
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
