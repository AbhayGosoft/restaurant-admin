import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/http.js";
import { eachBookedNight } from "../utils/dates.js";

export const bookingInclude = {
  stayProfile: {
    select: {
      id: true,
      name: true,
      ownerId: true,
      city: true,
      type: true,
      checkInTime: true,
      checkOutTime: true,
    },
  },
  room: true,
  ratePlan: true,
  payments: true,
  charges: { orderBy: { createdAt: "asc" } },
  services: { orderBy: { createdAt: "asc" } },
  guests: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.BookingInclude;

export const nextBookingRef = () => {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${stamp}-${random}`;
};

export const assertRoomBelongsToStay = async (stayProfileId: string, roomId: string) => {
  const room = await prisma.room.findFirst({
    where: { id: roomId, stayProfileId, status: "ACTIVE", stayProfile: { status: "ACTIVE" } },
    include: { stayProfile: true },
  });
  if (!room) {
    throw new ApiError(404, "Active room was not found for this stay");
  }
  return room;
};

export const assertRoomOpenForDates = async (
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  const room = await client.room.findUnique({
    where: { id: roomId },
    select: { physicalStatus: true, isBookable: true },
  });

  if (!room || !room.isBookable) {
    throw new ApiError(409, "Room is not bookable");
  }

  if (room.physicalStatus === "MAINTENANCE" || room.physicalStatus === "OCCUPIED") {
    throw new ApiError(409, "Room is occupied or under maintenance");
  }

  const dates = eachBookedNight(checkIn, checkOut);
  const blocked = await client.roomAvailability.findMany({
    where: {
      roomId,
      date: { in: dates },
      status: { in: ["UNAVAILABLE", "BOOKED"] },
    },
  });

  if (blocked.length > 0) {
    throw new ApiError(409, "Room is not available for one or more selected dates");
  }

  const blockedRanges = await client.roomBlock.findMany({
    where: { roomId, startDate: { lt: checkOut }, endDate: { gt: checkIn } },
  });

  if (blockedRanges.length > 0) {
    throw new ApiError(409, "Room is blocked for one or more selected dates");
  }
};

export const lockBookingDates = async (
  tx: Prisma.TransactionClient,
  bookingId: string,
  roomId: string,
  checkIn: Date,
  checkOut: Date,
) => {
  const dates = eachBookedNight(checkIn, checkOut);
  await Promise.all(
    dates.map((date) =>
      tx.roomAvailability.upsert({
        where: { roomId_date: { roomId, date } },
        create: { roomId, date, status: "BOOKED", bookingId },
        update: { status: "BOOKED", bookingId },
      }),
    ),
  );
};

export const unlockBookingDates = async (
  tx: Prisma.TransactionClient,
  bookingId: string,
) => {
  await tx.roomAvailability.updateMany({
    where: { bookingId },
    data: { status: "AVAILABLE", bookingId: null },
  });
};
