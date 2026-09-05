import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env } from "../config/env.js";
import { logger } from "../modules/logger.js";

export const razorpayConfigured = () => Boolean(env.razorpayKeyId && env.razorpayKeySecret);

const client = razorpayConfigured()
  ? new Razorpay({ key_id: env.razorpayKeyId!, key_secret: env.razorpayKeySecret! })
  : null;

/**
 * Creates a Razorpay order for the given amount (in paise). Falls back to a
 * synthesized mock order when no live keys are configured, so the rest of the
 * booking flow (initiate -> checkout -> verify -> booking) stays testable
 * end-to-end in local/dev without real Razorpay credentials.
 */
export const createRazorpayOrder = async (input: { amountPaise: number; currency: string; receipt: string }) => {
  if (!client) {
    logger.warn("RAZORPAY_KEY_ID/SECRET are not set; issuing a mock payment order for local testing");
    return {
      id: `order_mock_${crypto.randomBytes(12).toString("hex")}`,
      amount: input.amountPaise,
      currency: input.currency,
      mock: true,
    };
  }

  const order = await client.orders.create({
    amount: input.amountPaise,
    currency: input.currency,
    receipt: input.receipt,
  });
  return { id: order.id, amount: Number(order.amount), currency: order.currency, mock: false };
};

/** Verifies the HMAC-SHA256 signature Razorpay returns after a successful checkout. */
export const verifyRazorpaySignature = (input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean => {
  if (!env.razorpayKeySecret) {
    logger.warn("RAZORPAY_KEY_SECRET is not set; skipping signature verification for a mock payment");
    return input.signature === `mock_signature_${input.orderId}_${input.paymentId}`;
  }

  const expected = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(input.signature);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
};
