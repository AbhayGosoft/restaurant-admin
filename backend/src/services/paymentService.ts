import { prisma } from "../lib/prisma.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "../lib/razorpay.js";
import { env } from "../config/env.js";
import { getActiveRestaurantOrThrow } from "./restaurantService.js";
import { ApiError } from "../utils/http.js";

export type PaymentItemInput = { menuItemId: string; quantity: number };

/** Server-side total of the selected menu items for one restaurant. Prices always come from
 * the DB, never from the client, and every item must be active in an active category. */
export const calculateMenuTotal = async (client: { menuItem: { findMany: (args: any) => Promise<any[]> } }, restaurantId: string, items: PaymentItemInput[]) => {
  if (!items.length) throw new ApiError(422, "Select at least one menu item.");
  const uniqueIds = [...new Set(items.map((item) => item.menuItemId))];
  const menuItems = await client.menuItem.findMany({ where: { id: { in: uniqueIds }, isActive: true, menuCategory: { restaurantId, isActive: true } } });
  if (menuItems.length !== uniqueIds.length) throw new ApiError(422, "One or more menu items are unavailable.");
  const priceById = new Map(menuItems.map((item: any) => [item.id, Number(item.price)]));
  const total = items.reduce((sum, item) => sum + priceById.get(item.menuItemId)! * item.quantity, 0);
  return Math.round(total * 100) / 100;
};

/** The amount is decided here, server-side, from the selected menu items' DB prices. */
export const initiatePayment = async (restaurantUserId: string, input: { restaurantId: string; items: PaymentItemInput[] }) => {
  await getActiveRestaurantOrThrow(input.restaurantId);
  const amountInr = await calculateMenuTotal(prisma, input.restaurantId, input.items);
  if (amountInr < 1) throw new ApiError(422, "Order total must be at least ₹1.");
  // Old flow: fixed advance per booking (table booking). Kept for reference.
  // const amountInr = policy.bookingAdvanceInr;
  const order = await createRazorpayOrder({
    amountPaise: Math.round(amountInr * 100),
    currency: "INR",
    receipt: `ord_${restaurantUserId.slice(0, 8)}_${Date.now()}`,
  });

  const payment = await prisma.payment.create({
    data: {
      restaurantUserId,
      razorpayOrderId: order.id,
      amount: amountInr,
      currency: "INR",
      status: "CREATED",
    },
  });

  return {
    payment_id: payment.id,
    order_id: order.id,
    amount: amountInr,
    currency: "INR",
    key_id: env.razorpayKeyId ?? null,
    mock: order.mock,
  };
};

export const verifyPayment = async (
  restaurantUserId: string,
  input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
) => {
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: input.razorpay_order_id } });
  if (!payment || payment.restaurantUserId !== restaurantUserId) {
    throw new ApiError(404, "Payment order not found");
  }
  if (payment.status === "VERIFIED") throw new ApiError(409, "Payment has already been verified");
  if (payment.status === "FAILED") throw new ApiError(409, "This payment order is no longer valid");

  const valid = verifyRazorpaySignature({
    orderId: input.razorpay_order_id,
    paymentId: input.razorpay_payment_id,
    signature: input.razorpay_signature,
  });

  if (!valid) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw new ApiError(400, "Invalid payment signature");
  }

  const verified = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      razorpayPaymentId: input.razorpay_payment_id,
      razorpaySignature: input.razorpay_signature,
      status: "VERIFIED",
    },
  });

  return {
    payment_id: verified.id,
    order_id: verified.razorpayOrderId,
    amount: Number(verified.amount),
    currency: verified.currency,
    status: verified.status,
  };
};
