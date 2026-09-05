import { Router } from "express";
import { z } from "zod";
import { requireCustomerAuth } from "../middleware/auth.js";
import { cancelBooking, getBookingForCustomer, modifyBooking } from "../services/bookingService.js";
import { CANCELLATION_REASON_LABELS } from "../constants/bookingOptions.js";
import { asyncHandler, idParam, sendSuccess, validateBody } from "../utils/http.js";

const router = Router();
router.use(requireCustomerAuth);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const booking = await getBookingForCustomer(req.customer!.id, id);
    sendSuccess(res, booking);
  }),
);

const modifySchema = z
  .object({
    date: z.string().min(1).optional(),
    time: z.string().min(1).optional(),
    people: z.coerce.number().int().min(1).optional(),
  })
  .refine((body) => body.date || body.time || body.people, { message: "Provide at least one of date, time, people" });

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const body = validateBody(modifySchema, req.body);
    const booking = await modifyBooking(req.customer!.id, id, body);
    sendSuccess(res, booking, "Booking updated");
  }),
);

const cancelSchema = z.object({ reason: z.enum(Object.values(CANCELLATION_REASON_LABELS) as [string, ...string[]]) });

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const body = validateBody(cancelSchema, req.body);
    const result = await cancelBooking(req.customer!.id, id, body.reason);
    sendSuccess(res, result, "Booking cancelled");
  }),
);

export default router;
