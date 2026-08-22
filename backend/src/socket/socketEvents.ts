import type { Booking, Notification } from "../../generated/prisma/client.js";

export const socketEvents = {
  bookingNew: "booking:new",
  bookingConfirmed: "booking:confirmed",
  bookingCancelled: "booking:cancelled",
  bookingExpired: "booking:expired",
  bookingCheckedIn: "booking:checked-in",
  bookingCheckedOut: "booking:checked-out",
  bookingRoomChanged: "booking:room-changed",
  bookingExtended: "booking:extended",
  notificationNew: "notification:new",
  roomUpdate: "room:update",
} as const;

export type BookingSocketPayload = Booking & {
  stayProfile?: { id: string; ownerId: string; name: string };
};

export type NotificationSocketPayload = Notification;
