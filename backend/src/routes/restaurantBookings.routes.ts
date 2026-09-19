import { Router } from "express";
import { z } from "zod";
import { requireCustomerAuth } from "../middleware/auth.js";
import { cancelBooking, getBookingForCustomer, getPreorderForCustomer, modifyBooking, removePreorderItemForCustomer, replacePreorderForCustomer } from "../services/bookingService.js";
import { CANCELLATION_REASON_LABELS } from "../constants/bookingOptions.js";
import { asyncHandler, idParam, sendSuccess, validateBody } from "../utils/http.js";

const router = Router();
router.use(requireCustomerAuth);

// OpenAPI docs: src/docs/restaurantBookings.docs.ts
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

const preorderSchema = z.object({ items: z.array(z.object({ menuItemId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(50), note: z.string().trim().max(500).optional() })).max(50) });
router.get("/:id/preorder", requireCustomerAuth, asyncHandler(async (req, res) => {
  sendSuccess(res, await getPreorderForCustomer(req.customer!.id, idParam(req)));
}));
router.put("/:id/preorder", requireCustomerAuth, asyncHandler(async (req, res) => {
  const body = validateBody(preorderSchema, req.body);
  sendSuccess(res, await replacePreorderForCustomer(req.customer!.id, idParam(req), body.items), "Pre-order updated");
}));
router.delete("/:id/preorder/items/:itemId", requireCustomerAuth, asyncHandler(async (req, res) => {
  sendSuccess(res, await removePreorderItemForCustomer(req.customer!.id, idParam(req), idParam(req, "itemId")), "Pre-order item removed");
}));

export default router;
