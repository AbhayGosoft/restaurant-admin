import type { BookingStatus, Prisma } from "../../generated/prisma/client.js";
import { bookingInclude } from "../services/bookingService.js";

export const findBookingForLifecycle = (tx: Prisma.TransactionClient, bookingId: string) =>
  tx.booking.findUnique({
    where: { id: bookingId },
    include: {
      ...bookingInclude,
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
    },
  });

export const writeBookingEvent = (
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    type:
      | "CREATED"
      | "CONFIRMED"
      | "CHECKED_IN"
      | "CHECKED_OUT"
      | "ROOM_CHANGED"
      | "ROOM_EXCHANGED"
      | "EXTENDED"
      | "CHARGE_ADDED"
      | "CHARGE_REMOVED"
      | "SERVICE_ADDED"
      | "SERVICE_UPDATED"
      | "SERVICE_REMOVED"
      | "RATE_PLAN_CHANGED"
      | "GUEST_ADDED"
      | "GUEST_UPDATED"
      | "GUEST_REMOVED"
      | "CANCELLED"
      | "AUTO_CANCELLED"
      | "REJECTED"
      | "EXPIRED"
      | "ADAPTER_SYNC_REQUESTED"
      | "NOTIFICATION_QUEUED";
    fromStatus?: BookingStatus | null;
    toStatus?: BookingStatus | null;
    actorType?: string;
    actorId?: string;
    metadata?: Prisma.InputJsonValue;
  },
) =>
  tx.bookingEvent.create({
    data: {
      bookingId: input.bookingId,
      type: input.type,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorType: input.actorType ?? "SYSTEM",
      actorId: input.actorId,
      metadata: input.metadata,
    },
  });
