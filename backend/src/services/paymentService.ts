import { prisma } from "../lib/prisma.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "../lib/razorpay.js";
import { env } from "../config/env.js";
import { policy } from "../config/policy.js";
import { ApiError } from "../utils/http.js";

/** The advance amount is decided here, server-side, and never taken from the client. */
export const initiatePayment = async (restaurantUserId: string) => {
  const amountInr = policy.bookingAdvanceInr;
  const order = await createRazorpayOrder({
    amountPaise: amountInr * 100,
    currency: "INR",
    receipt: `adv_${restaurantUserId.slice(0, 8)}_${Date.now()}`,
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
