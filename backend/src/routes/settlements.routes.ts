import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";
import { parseDateOnly } from "../utils/dates.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const settlements = await prisma.settlement.findMany({
      where: req.user!.role === "ADMIN" ? {} : { ownerId: req.user!.id },
      include: { items: true, stayProfile: true, owner: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(settlements);
  }),
);

router.post(
  "/generate",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(
      z.object({
        ownerId: z.string().uuid(),
        stayProfileId: z.string().uuid().optional(),
        periodStart: z.string(),
        periodEnd: z.string(),
        commissionPercent: z.coerce.number().min(0).max(100).default(0),
      }),
      req.body,
    );

    const periodStart = parseDateOnly(body.periodStart);
    const periodEnd = parseDateOnly(body.periodEnd);
    const bookings = await prisma.booking.findMany({
      where: {
        bookingStatus: { in: ["PENDING", "COMPLETED"] },
        stayProfile: { ownerId: body.ownerId, id: body.stayProfileId },
        checkInDate: { gte: periodStart },
        checkOutDate: { lte: periodEnd },
      },
    });

    if (bookings.length === 0) {
      throw new ApiError(422, "No pending/completed bookings found for this settlement period");
    }

    const gross = bookings.reduce((sum, booking) => sum + Number(booking.totalAmount), 0);
    const commission = Number(((gross * body.commissionPercent) / 100).toFixed(2));
    const settlement = await prisma.settlement.create({
      data: {
        ownerId: body.ownerId,
        stayProfileId: body.stayProfileId,
        periodStart,
        periodEnd,
        totalBookingAmount: gross,
        commissionAmount: commission,
        payableAmount: gross - commission,
        items: {
          create: bookings.map((booking) => {
            const itemCommission = Number(((Number(booking.totalAmount) * body.commissionPercent) / 100).toFixed(2));
            return {
              bookingId: booking.id,
              roomId: booking.roomId,
              stayProfileId: booking.stayProfileId,
              grossAmount: booking.totalAmount,
              commissionAmount: itemCommission,
              payableAmount: Number(booking.totalAmount) - itemCommission,
            };
          }),
        },
      },
      include: { items: true },
    });

    res.status(201).json(settlement);
  }),
);

router.patch(
  "/:id/paid",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const settlement = await prisma.settlement.update({
      where: { id: idParam(req) },
      data: { status: "PAID", paidOn: new Date() },
    });
    res.json(settlement);
  }),
);

export default router;
