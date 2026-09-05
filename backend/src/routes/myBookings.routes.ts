import { Router } from "express";
import { z } from "zod";
import { requireCustomerAuth } from "../middleware/auth.js";
import { listMyBookings } from "../services/bookingService.js";
import { asyncHandler, sendSuccess, validateQuery } from "../utils/http.js";

const router = Router();
router.use(requireCustomerAuth);

const querySchema = z.object({ filter: z.enum(["upcoming", "past"]).optional() });

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = validateQuery(querySchema, req.query);
    // req.user's identity comes only from the verified JWT — never from a client-supplied id.
    const bookings = await listMyBookings(req.customer!.id, query.filter);
    sendSuccess(res, bookings);
  }),
);

export default router;
