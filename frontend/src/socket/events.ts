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
