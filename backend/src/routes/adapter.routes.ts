import { Router } from "express";
import { requireAdapterHmac } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, validateBody } from "../utils/http.js";
import { adapterBookingSchema, createPendingAdapterBooking } from "../services/adapterBookingService.js";
import { confirmBooking, rejectBooking } from "../services/bookingLifecycleService.js";

const router = Router();

router.use(requireAdapterHmac);

const findBookingId = async (idOrRef: string) => {
  const booking = await prisma.booking.findFirst({
    where: { OR: [{ id: idOrRef }, { bookingRef: idOrRef }] },
    select: { id: true },
  });
  return booking?.id ?? idOrRef;
};

router.post(
  "/bookings",
  asyncHandler(async (req, res) => {
    const body = validateBody(adapterBookingSchema, req.body);
    const booking = await createPendingAdapterBooking(body);
    res.status(201).json({
      id: booking.id,
      pms_booking_id: booking.bookingRef,
      status: booking.bookingStatus.toLowerCase(),
      expires_at: booking.expiresAt?.toISOString(),
      price: Number(booking.totalAmount).toFixed(2),
    });
  }),
);

router.post(
  "/bookings/:id/confirm",
  asyncHandler(async (req, res) => {
    const booking = await confirmBooking(await findBookingId(String(req.params.id)), { type: "ADAPTER" });
    res.json({ id: booking.id, pms_booking_id: booking.bookingRef, status: booking.bookingStatus.toLowerCase() });
  }),
);

router.post(
  "/bookings/:id/cancel",
  asyncHandler(async (req, res) => {
    const booking = await rejectBooking(await findBookingId(String(req.params.id)), { type: "ADAPTER" }, "REJECTED", { syncAdapter: false });
    res.json({ id: booking.id, pms_booking_id: booking.bookingRef, status: booking.bookingStatus.toLowerCase() });
  }),
);

export default router;
