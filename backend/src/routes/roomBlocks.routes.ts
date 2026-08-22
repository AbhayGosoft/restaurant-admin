import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { assertPropertyAccess } from "../services/propertyAccessService.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";
import { parseDateOnly } from "../utils/dates.js";

const router = Router();

const roomBlockSchema = z.object({
  roomId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.enum(["BLOCKED", "MAINTENANCE"]).default("BLOCKED"),
  notes: z.string().optional(),
});

router.use(requireAuth);

const loadRoomForBlock = async (roomId: string) => {
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true, stayProfileId: true } });
  if (!room) throw new ApiError(404, "Room not found");
  return room;
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
    const roomId = req.query.roomId ? String(req.query.roomId) : undefined;
    if (propertyId) await assertPropertyAccess(req.user!.id, req.user!.role, propertyId);

    const from = req.query.from ? parseDateOnly(String(req.query.from)) : undefined;
    const to = req.query.to ? parseDateOnly(String(req.query.to)) : undefined;

    const blocks = await prisma.roomBlock.findMany({
      where: {
        roomId,
        room: propertyId ? { stayProfileId: propertyId } : undefined,
        startDate: to ? { lt: to } : undefined,
        endDate: from ? { gt: from } : undefined,
      },
      orderBy: { startDate: "asc" },
    });
    res.json(blocks);
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = validateBody(roomBlockSchema, req.body);
    const room = await loadRoomForBlock(body.roomId);
    await assertPropertyAccess(req.user!.id, req.user!.role, room.stayProfileId);

    const startDate = parseDateOnly(body.startDate);
    const endDate = parseDateOnly(body.endDate);
    if (endDate <= startDate) throw new ApiError(422, "endDate must be after startDate");

    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        roomId: body.roomId,
        bookingStatus: "CONFIRMED",
        checkInDate: { lt: endDate },
        checkOutDate: { gt: startDate },
      },
    });
    if (conflictingBooking) throw new ApiError(409, "Room has a confirmed booking in this date range");

    const block = await prisma.roomBlock.create({
      data: { roomId: body.roomId, startDate, endDate, reason: body.reason, notes: body.notes },
    });
    res.status(201).json(block);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const block = await prisma.roomBlock.findUnique({ where: { id: idParam(req) }, include: { room: true } });
    if (!block) throw new ApiError(404, "Block not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, block.room.stayProfileId);
    await prisma.roomBlock.delete({ where: { id: block.id } });
    res.status(204).send();
  }),
);

export default router;
