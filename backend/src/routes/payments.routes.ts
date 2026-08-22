import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler, validateBody } from "../utils/http.js";

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = validateBody(
      z.object({
        bookingId: z.string().uuid(),
        amount: z.coerce.number().positive(),
        paymentMode: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"]),
        transactionRef: z.string().optional(),
        status: z.enum(["SUCCESS", "PENDING", "FAILED", "REFUNDED"]).default("SUCCESS"),
      }),
      req.body,
    );

    const booking = await prisma.booking.findUnique({
      where: { id: body.bookingId },
      include: { stayProfile: true },
    });
    if (!booking) throw new ApiError(404, "Booking not found");
    if (req.user!.role !== "ADMIN" && booking.stayProfile.ownerId !== req.user!.id) {
      throw new ApiError(403, "You cannot add payment for this booking");
    }

    const payment = await prisma.payment.create({ data: body });
    const paidSum = await prisma.payment.aggregate({
      where: { bookingId: body.bookingId, status: "SUCCESS" },
      _sum: { amount: true },
    });
    const paid = Number(paidSum._sum.amount ?? 0);
    const total = Number(booking.totalAmount);
    await prisma.booking.update({
      where: { id: body.bookingId },
      data: { paymentStatus: paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID" },
    });

    res.status(201).json(payment);
  }),
);

export default router;
