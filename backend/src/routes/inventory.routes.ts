import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { assertPropertyAccess } from "../services/propertyAccessService.js";
import { asyncHandler } from "../utils/http.js";
import { parseDateOnly } from "../utils/dates.js";

const router = Router();
router.use(requireAuth);

const ONE_DAY_MS = 86_400_000;

const calendarQuerySchema = z.object({ propertyId: z.string().uuid(), month: z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM") });
const dateQuerySchema = z.object({ propertyId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD") });
const roomsQuerySchema = dateQuerySchema.extend({ checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkOutDate must be YYYY-MM-DD").optional() });

const bucketSource = (source: string): "ota" | "walkIn" | "direct" => {
  if (source === "SAAS_ADAPTER") return "ota";
  if (source === "WALK_IN") return "walkIn";
  return "direct";
};

async function loadInventoryContext(propertyId: string, rangeStart: Date, rangeEnd: Date) {
  const [rooms, bookings, blocks, availability] = await Promise.all([
    prisma.room.findMany({
      where: { stayProfileId: propertyId, status: "ACTIVE" },
      select: { id: true, name: true, roomNumber: true, floor: true, physicalStatus: true, isClean: true, isBookable: true, basePrice: true, enterpriseRoomType: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        stayProfileId: propertyId,
        bookingStatus: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkInDate: { lt: rangeEnd },
        checkOutDate: { gt: rangeStart },
      },
      select: { id: true, roomId: true, checkInDate: true, checkOutDate: true, guestName: true, guestPhone: true, source: true, bookingRef: true, noOfGuests: true },
    }),
    prisma.roomBlock.findMany({
      where: { room: { stayProfileId: propertyId }, startDate: { lt: rangeEnd }, endDate: { gt: rangeStart } },
    }),
    prisma.roomAvailability.findMany({
      where: {
        room: { stayProfileId: propertyId },
        date: { gte: rangeStart, lt: rangeEnd },
        status: { in: ["BOOKED", "UNAVAILABLE"] },
      },
      include: {
        booking: {
          select: { id: true, roomId: true, checkInDate: true, checkOutDate: true, guestName: true, guestPhone: true, source: true, bookingRef: true, noOfGuests: true, bookingStatus: true },
        },
      },
    }),
  ]);
  return { rooms, bookings, blocks, availability };
}

type InventoryContext = Awaited<ReturnType<typeof loadInventoryContext>>;

function findBookingForRoomDate(bookings: InventoryContext["bookings"], roomId: string, date: Date) {
  return bookings.find((b) => b.roomId === roomId && b.checkInDate <= date && date < b.checkOutDate);
}

function findBlockForRoomDate(blocks: InventoryContext["blocks"], roomId: string, date: Date) {
  return blocks.find((b) => b.roomId === roomId && b.startDate <= date && date < b.endDate);
}

function findAvailabilityForRoomDate(availability: InventoryContext["availability"], roomId: string, date: Date) {
  return availability.find((entry) => entry.roomId === roomId && entry.date.getTime() === date.getTime());
}

router.get(
  "/calendar",
  asyncHandler(async (req, res) => {
    const query = calendarQuerySchema.parse(req.query);
    await assertPropertyAccess(req.user!.id, req.user!.role, query.propertyId);

    const [year, month] = query.month.split("-").map(Number);
    const rangeStart = new Date(Date.UTC(year, month - 1, 1));
    const rangeEnd = new Date(Date.UTC(year, month, 1));
    const { rooms, bookings, blocks, availability } = await loadInventoryContext(query.propertyId, rangeStart, rangeEnd);
    const totalRooms = rooms.length;

    const days = [];
    for (let time = rangeStart.getTime(); time < rangeEnd.getTime(); time += ONE_DAY_MS) {
      const date = new Date(time);
      let bookedRooms = 0;
      let blockedRooms = 0;
      let maintenanceRooms = 0;
      for (const room of rooms) {
        if (room.physicalStatus === "MAINTENANCE") {
          maintenanceRooms += 1;
          continue;
        }
        if (room.physicalStatus === "OCCUPIED") {
          bookedRooms += 1;
          continue;
        }
        const availabilityEntry = findAvailabilityForRoomDate(availability, room.id, date);
        if (findBookingForRoomDate(bookings, room.id, date) || availabilityEntry?.status === "BOOKED") {
          bookedRooms += 1;
          continue;
        }
        if (availabilityEntry?.status === "UNAVAILABLE") {
          blockedRooms += 1;
          continue;
        }
        const block = findBlockForRoomDate(blocks, room.id, date);
        if (block) {
          if (block.reason === "MAINTENANCE") maintenanceRooms += 1;
          else blockedRooms += 1;
        }
      }
      const availableRooms = totalRooms - bookedRooms - blockedRooms - maintenanceRooms;
      const status = totalRooms === 0 ? "AVAILABLE" : availableRooms === 0 ? "FULL" : availableRooms / totalRooms <= 0.25 ? "LOW" : "AVAILABLE";
      days.push({ date: date.toISOString().slice(0, 10), totalRooms, availableRooms, bookedRooms, blockedRooms, maintenanceRooms, status });
    }
    res.json(days);
  }),
);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const query = dateQuerySchema.parse(req.query);
    await assertPropertyAccess(req.user!.id, req.user!.role, query.propertyId);
    const date = parseDateOnly(query.date);
    const rangeEnd = new Date(date.getTime() + ONE_DAY_MS);
    const { rooms, bookings, blocks, availability } = await loadInventoryContext(query.propertyId, date, rangeEnd);
    const totalRooms = rooms.length;

    let bookedRooms = 0;
    let blockedRooms = 0;
    let maintenanceRooms = 0;
    let ota = 0;
    let direct = 0;
    let walkIn = 0;
    for (const room of rooms) {
      if (room.physicalStatus === "MAINTENANCE") {
        maintenanceRooms += 1;
        continue;
      }
      if (room.physicalStatus === "OCCUPIED") {
        bookedRooms += 1;
        continue;
      }
      const availabilityEntry = findAvailabilityForRoomDate(availability, room.id, date);
      const booking = findBookingForRoomDate(bookings, room.id, date) ?? (availabilityEntry?.booking && ["CONFIRMED", "CHECKED_IN"].includes(availabilityEntry.booking.bookingStatus) ? availabilityEntry.booking : undefined);
      if (booking || availabilityEntry?.status === "BOOKED") {
        bookedRooms += 1;
        if (booking) {
          const bucket = bucketSource(booking.source);
          if (bucket === "ota") ota += 1;
          else if (bucket === "walkIn") walkIn += 1;
          else direct += 1;
        }
        continue;
      }
      if (availabilityEntry?.status === "UNAVAILABLE") {
        blockedRooms += 1;
        continue;
      }
      const block = findBlockForRoomDate(blocks, room.id, date);
      if (block) {
        if (block.reason === "MAINTENANCE") maintenanceRooms += 1;
        else blockedRooms += 1;
      }
    }
    const availableRooms = totalRooms - bookedRooms - blockedRooms - maintenanceRooms;

    res.json({
      date: query.date,
      totalRooms,
      availableRooms,
      bookedRooms,
      blockedRooms,
      maintenanceRooms,
      otaBookings: ota,
      directBookings: direct,
      walkInBookings: walkIn,
    });
  }),
);

router.get(
  "/rooms",
  asyncHandler(async (req, res) => {
    const query = roomsQuerySchema.parse(req.query);
    await assertPropertyAccess(req.user!.id, req.user!.role, query.propertyId);
    const date = parseDateOnly(query.date);
    const parsedCheckOut = query.checkOutDate ? parseDateOnly(query.checkOutDate) : undefined;
    const rangeEnd = parsedCheckOut && parsedCheckOut > date ? parsedCheckOut : new Date(date.getTime() + ONE_DAY_MS);
    const { rooms, bookings, blocks, availability } = await loadInventoryContext(query.propertyId, date, rangeEnd);

    const result = rooms.map((room) => {
      const availabilityEntry = availability.find((entry) => entry.roomId === room.id);
      const booking = bookings.find((entry) => entry.roomId === room.id) ?? (availabilityEntry?.booking && ["CONFIRMED", "CHECKED_IN"].includes(availabilityEntry.booking.bookingStatus) ? availabilityEntry.booking : undefined);
      const block = blocks.find((entry) => entry.roomId === room.id);
      const status: "BOOKED" | "BLOCKED" | "MAINTENANCE" | "OCCUPIED" | "AVAILABLE" =
        booking || availabilityEntry?.status === "BOOKED"
          ? "BOOKED"
          : room.physicalStatus === "MAINTENANCE"
            ? "MAINTENANCE"
            : room.physicalStatus === "OCCUPIED"
              ? "OCCUPIED"
              : availabilityEntry?.status === "UNAVAILABLE"
                ? "BLOCKED"
                : block
                  ? block.reason
                  : "AVAILABLE";

      return {
        id: room.id,
        name: room.name,
        roomNumber: room.roomNumber,
        floor: room.floor,
        physicalStatus: room.physicalStatus,
        roomTypeName: room.enterpriseRoomType?.name ?? null,
        basePrice: room.basePrice,
        isClean: room.isClean,
        isBookable: room.isBookable,
        status,
        booking: booking
          ? {
              id: booking.id,
              bookingRef: booking.bookingRef,
              guestName: booking.guestName,
              guestPhone: booking.guestPhone,
              source: booking.source,
              checkInDate: booking.checkInDate,
              checkOutDate: booking.checkOutDate,
              noOfGuests: booking.noOfGuests,
            }
          : null,
        block: block ? { id: block.id, reason: block.reason, notes: block.notes, startDate: block.startDate, endDate: block.endDate } : null,
      };
    });
    res.json(result);
  }),
);

export default router;
