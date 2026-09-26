import { Router } from "express";
import { z } from "zod";
import { requireCustomerAuth } from "../../middleware/auth.js";
import { initiatePayment, verifyPayment } from "../../services/paymentService.js";
import { asyncHandler, sendSuccess, validateBody } from "../../utils/http.js";

const router = Router();
router.use(requireCustomerAuth);

// OpenAPI docs: src/docs/user/payments.docs.ts
const initiateSchema = z.object({
  restaurantId: z.string().uuid(),
  items: z.array(z.object({ menuItemId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(50) })).min(1).max(50),
});

router.post(
  "/initiate",
  asyncHandler(async (req, res) => {
    const body = validateBody(initiateSchema, req.body);
    const order = await initiatePayment(req.customer!.id, body);
    sendSuccess(res, order, "Payment order created");
  }),
);

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

router.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const body = validateBody(verifySchema, req.body);
    const payment = await verifyPayment(req.customer!.id, body);
    sendSuccess(res, payment, "Payment verified");
  }),
);

export default router;
