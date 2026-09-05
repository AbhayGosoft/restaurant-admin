import type { Notification, RestaurantBooking } from "../../generated/prisma/client.js";

export const socketEvents = {
  bookingNew: "restaurant:booking:new",
  bookingModified: "restaurant:booking:modified",
  bookingCancelled: "restaurant:booking:cancelled",
  notificationNew: "restaurant:notification:new",
} as const;

export type BookingSocketPayload = RestaurantBooking;
export type NotificationSocketPayload = Notification;
