import { Router } from "express";
import { z } from "zod";
import type { BookingStatus } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";
import { dateRangeNights, parseDateOnly } from "../utils/dates.js";
import { assertOwnerSetupCompleted, assertPropertyAccess } from "../services/propertyAccessService.js";
import { listQuerySchema } from "../utils/query.js";
import {
  assertRoomBelongsToStay,
  assertRoomOpenForDates,
  bookingInclude,
  lockBookingDates,
  unlockBookingDates,
} from "../services/bookingService.js";
import { writeBookingEvent } from "../repositories/bookingRepository.js";
import { emitToProperty } from "../socket/server.js";
import { socketEvents } from "../socket/socketEvents.js";
import {
  addBookingCharge,
  addBookingGuest,
  addBookingService,
  changeBookingRatePlan,
  checkInBooking,
  checkOutBooking,
  confirmBooking,
  createConfirmedBooking,
  createPendingBooking,
  exchangeBookingRooms,
  extendBookingStay,
  rejectBooking,
  removeBookingCharge,
  removeBookingGuest,
  removeBookingService,
  updateBookingGuest,
  updateBookingServiceQuantity,
} from "../services/bookingLifecycleService.js";

const router = Router();
const bookingStatuses = ["PENDING", "CONFIRMED", "CHECKED_IN", "CANCELLED", "COMPLETED", "EXPIRED", "AUTO_CANCELLED", "REJECTED"] as const;
const stayChargeSchema = z.object({
  type: z.enum(["NONE", "FULL", "MANUAL"]),
  charge: z.coerce.number().min(0).optional(),
});

const phoneSchema = z.string().regex(/^(?:\d{7,10}|\+\d{8,14})$/, "Enter a valid phone number with up to 10 digits or international code");

const createBookingSchema = z.object({
  stayProfileId: z.string().uuid(),
  roomId: z.string().uuid(),
  guestName: z.string().min(2),
  guestPhone: phoneSchema,
  guestEmail: z.email().optional(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  noOfGuests: z.coerce.number().int().min(1),
  totalAmount: z.coerce.number().positive().optional(),
  source: z.enum(["DIRECT_SITE", "PHONE", "WALK_IN", "ADMIN_ADDED", "SAAS_ADAPTER"]).default("DIRECT_SITE"),
  notes: z.string().optional(),
});

const canAccessBooking = async (userId: string, role: string, bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { stayProfile: true },
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (role !== "ADMIN" && booking.stayProfile.ownerId !== userId) throw new ApiError(403, "You cannot access this booking");
  return booking;
};

router.post(
  "/public",
  asyncHandler(async (req, res) => {
    const body = validateBody(createBookingSchema, req.body);
    const checkInDate = parseDateOnly(body.checkInDate);
    const checkOutDate = parseDateOnly(body.checkOutDate);
    const nights = dateRangeNights(checkInDate, checkOutDate);
    const room = await assertRoomBelongsToStay(body.stayProfileId, body.roomId);
    const booking = await createConfirmedBooking({
      stayProfileId: body.stayProfileId,
      roomId: body.roomId,
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      guestEmail: body.guestEmail,
      checkInDate,
      checkOutDate,
      noOfGuests: body.noOfGuests,
      totalAmount: body.totalAmount ?? Number(room.basePrice) * nights,
      source: body.source,
      notes: body.notes,
    }, { type: req.user!.role, id: req.user!.id });
    res.status(201).json(booking);
  }),
);

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = req.query.status && bookingStatuses.includes(String(req.query.status) as BookingStatus) ? String(req.query.status) as BookingStatus : undefined;
    const query = listQuerySchema.pick({ propertyId: true }).parse(req.query);
    if (query.propertyId) await assertPropertyAccess(req.user!.id, req.user!.role, query.propertyId);
    const date = req.query.date ? parseDateOnly(String(req.query.date)) : undefined;
    const dateRangeEnd = date ? new Date(date.getTime() + 86_400_000) : undefined;

    const bookings = await prisma.booking.findMany({
      where: {
        bookingStatus: status,
        stayProfileId: query.propertyId,
        stayProfile: query.propertyId || req.user!.role === "ADMIN" ? undefined : { ownerId: req.user!.id },
        checkInDate: date ? { lt: dateRangeEnd } : undefined,
        checkOutDate: date ? { gt: date } : undefined,
      },
      include: bookingInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json(bookings);
  }),
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(createBookingSchema, req.body);
    const checkInDate = parseDateOnly(body.checkInDate);
    const checkOutDate = parseDateOnly(body.checkOutDate);
    const nights = dateRangeNights(checkInDate, checkOutDate);
    const room = await assertRoomBelongsToStay(body.stayProfileId, body.roomId);
    if (req.user!.role !== "ADMIN" && room.stayProfile.ownerId !== req.user!.id) {
      throw new ApiError(403, "You cannot create bookings for this stay");
    }
    if (req.user!.role === "OWNER") {
      await assertOwnerSetupCompleted(req.user!.id);
    }
    await assertRoomOpenForDates(room.id, checkInDate, checkOutDate);

    const booking = await createPendingBooking({
      stayProfileId: body.stayProfileId,
      roomId: body.roomId,
      guestName: body.guestName,
      guestPhone: body.guestPhone,
      guestEmail: body.guestEmail,
      checkInDate,
      checkOutDate,
      noOfGuests: body.noOfGuests,
      totalAmount: body.totalAmount ?? Number(room.basePrice) * nights,
      source: body.source,
      notes: body.notes,
    });
    res.status(201).json(booking);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const bookingId = idParam(req);
    await canAccessBooking(req.user!.id, req.user!.role, bookingId);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: bookingInclude });
    res.json(booking);
  }),
);

router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    // COMPLETED is intentionally not settable here — it can only be reached via
    // /check-out, which requires the booking to have been checked in first and
    // records the late-checkout charge. Otherwise this bypasses the whole
    // check-in/check-out flow with a single "Complete" click.
    const body = validateBody(z.object({ status: z.enum(["CONFIRMED", "CANCELLED", "EXPIRED", "AUTO_CANCELLED", "REJECTED"]) }), req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));

    const updated =
      body.status === "CONFIRMED"
        ? await confirmBooking(booking.id, { type: req.user!.role, id: req.user!.id })
        : ["CANCELLED", "REJECTED"].includes(body.status)
          ? await rejectBooking(booking.id, { type: req.user!.role, id: req.user!.id }, body.status as "CANCELLED" | "REJECTED")
          : await prisma.booking.update({
              where: { id: booking.id },
              data: { bookingStatus: body.status, respondedAt: new Date(), version: { increment: 1 } },
              include: bookingInclude,
            });

    res.json(updated);
  }),
);

router.patch(
  "/:id/check-in",
  asyncHandler(async (req, res) => {
    const body = validateBody(stayChargeSchema, req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await checkInBooking(booking.id, { type: req.user!.role, id: req.user!.id }, {
      earlyCheckinType: body.type,
      earlyCheckinCharge: body.charge,
    });
    res.json(updated);
  }),
);

router.patch(
  "/:id/check-out",
  asyncHandler(async (req, res) => {
    const body = validateBody(stayChargeSchema, req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await checkOutBooking(booking.id, { type: req.user!.role, id: req.user!.id }, {
      lateCheckoutType: body.type,
      lateCheckoutCharge: body.charge,
    });
    res.json(updated);
  }),
);

router.patch(
  "/:id/extend",
  asyncHandler(async (req, res) => {
    const body = validateBody(z.object({ checkOutDate: z.string(), totalAmount: z.coerce.number().positive() }), req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await extendBookingStay(booking.id, { type: req.user!.role, id: req.user!.id }, {
      checkOutDate: parseDateOnly(body.checkOutDate),
      totalAmount: body.totalAmount,
    });
    res.json(updated);
  }),
);

router.patch(
  "/:id/room",
  asyncHandler(async (req, res) => {
    const body = validateBody(z.object({ roomId: z.string().uuid() }), req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));

    if (!["PENDING", "CONFIRMED", "CHECKED_IN"].includes(booking.bookingStatus)) {
      throw new ApiError(409, `Cannot change room for a ${booking.bookingStatus} booking`);
    }
    if (body.roomId === booking.roomId) {
      throw new ApiError(422, "Booking is already assigned to this room");
    }

    const newRoom = await assertRoomBelongsToStay(booking.stayProfileId, body.roomId);
    const holdsDateLocks = booking.bookingStatus === "CONFIRMED" || booking.bookingStatus === "CHECKED_IN";
    const previousRoomId = booking.roomId;

    const updated = await prisma.$transaction(async (tx) => {
      await assertRoomOpenForDates(newRoom.id, booking.checkInDate, booking.checkOutDate, tx);
      if (holdsDateLocks) {
        await unlockBookingDates(tx, booking.id);
      }
      const result = await tx.booking.update({
        where: { id: booking.id },
        data: { roomId: newRoom.id, version: { increment: 1 } },
        include: bookingInclude,
      });
      if (holdsDateLocks) {
        await lockBookingDates(tx, booking.id, newRoom.id, booking.checkInDate, booking.checkOutDate);
      }
      await writeBookingEvent(tx, {
        bookingId: booking.id,
        type: "ROOM_CHANGED",
        actorType: req.user!.role,
        actorId: req.user!.id,
        metadata: { previousRoomId, newRoomId: newRoom.id },
      });
      return result;
    });

    emitToProperty(booking.stayProfileId, socketEvents.bookingRoomChanged, updated);
    res.json(updated);
  }),
);

router.post(
  "/:id/exchange",
  asyncHandler(async (req, res) => {
    const body = validateBody(z.object({ withBookingId: z.string().uuid() }), req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    await canAccessBooking(req.user!.id, req.user!.role, body.withBookingId);
    const updated = await exchangeBookingRooms(booking.id, body.withBookingId, { type: req.user!.role, id: req.user!.id });
    res.json(updated);
  }),
);

router.post(
  "/:id/charges",
  asyncHandler(async (req, res) => {
    const body = validateBody(z.object({ label: z.string().min(2), amount: z.coerce.number().positive() }), req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await addBookingCharge(booking.id, { type: req.user!.role, id: req.user!.id }, body);
    res.json(updated);
  }),
);

router.delete(
  "/:id/charges/:chargeId",
  asyncHandler(async (req, res) => {
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await removeBookingCharge(booking.id, String(req.params.chargeId), { type: req.user!.role, id: req.user!.id });
    res.json(updated);
  }),
);

router.post(
  "/:id/services",
  asyncHandler(async (req, res) => {
    const body = validateBody(z.object({ serviceId: z.string().uuid(), quantity: z.coerce.number().int().min(1).default(1) }), req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await addBookingService(booking.id, { type: req.user!.role, id: req.user!.id }, body);
    res.json(updated);
  }),
);

router.patch(
  "/:id/services/:serviceLineId",
  asyncHandler(async (req, res) => {
    const body = validateBody(z.object({ quantity: z.coerce.number().int().min(1) }), req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await updateBookingServiceQuantity(booking.id, String(req.params.serviceLineId), { type: req.user!.role, id: req.user!.id }, body.quantity);
    res.json(updated);
  }),
);

router.delete(
  "/:id/services/:serviceLineId",
  asyncHandler(async (req, res) => {
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await removeBookingService(booking.id, String(req.params.serviceLineId), { type: req.user!.role, id: req.user!.id });
    res.json(updated);
  }),
);

router.patch(
  "/:id/rate-plan",
  asyncHandler(async (req, res) => {
    const body = validateBody(z.object({ ratePlanId: z.string().uuid().nullable(), totalAmount: z.coerce.number().positive() }), req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await changeBookingRatePlan(booking.id, { type: req.user!.role, id: req.user!.id }, body);
    res.json(updated);
  }),
);

const bookingGuestSchema = z.object({ name: z.string().min(2), phone: phoneSchema.optional(), email: z.email().optional() });

router.post(
  "/:id/guests",
  asyncHandler(async (req, res) => {
    const body = validateBody(bookingGuestSchema, req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await addBookingGuest(booking.id, { type: req.user!.role, id: req.user!.id }, body);
    res.json(updated);
  }),
);

router.patch(
  "/:id/guests/:guestId",
  asyncHandler(async (req, res) => {
    const body = validateBody(bookingGuestSchema, req.body);
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await updateBookingGuest(booking.id, String(req.params.guestId), { type: req.user!.role, id: req.user!.id }, body);
    res.json(updated);
  }),
);

router.delete(
  "/:id/guests/:guestId",
  asyncHandler(async (req, res) => {
    const booking = await canAccessBooking(req.user!.id, req.user!.role, idParam(req));
    const updated = await removeBookingGuest(booking.id, String(req.params.guestId), { type: req.user!.role, id: req.user!.id });
    res.json(updated);
  }),
);

export default router;
