import type { RestaurantBooking } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { getActiveRestaurantOrThrow } from "./restaurantService.js";
import { getBookedSeatCount } from "./slotService.js";
// Table booking flow is disabled for now — bookings are capacity-based menu orders.
// import { findAvailableTable } from "./slotService.js";
import { calculateMenuTotal } from "./paymentService.js";
import { cancelReminder, scheduleReminder } from "../queues/reminderQueue.js";
import { notifyCustomer } from "./notificationService.js";
import { emitToRestaurant } from "../socket/server.js";
import { socketEvents } from "../socket/socketEvents.js";
import { policy, decideRefund } from "../config/policy.js";
import { ApiError } from "../utils/http.js";
import { resolveAssetUrl } from "../utils/images.js";
import { combineDateAndTime, formatDateOnly, isWithinBookingWindow, parseDateOnly } from "../utils/dates.js";
import { isValidTime12, to12Hour, to24Hour } from "../utils/slotTime.js";
import { generateHumanBookingId } from "../utils/bookingId.js";
import { haversineDistanceKm } from "../utils/geo.js";
import { CANCELLATION_REASON_BY_LABEL, CANCELLATION_REASON_LABELS, TABLE_PREFERENCE_BY_LABEL, TABLE_PREFERENCE_LABELS } from "../constants/bookingOptions.js";

export type BookingClientStatus = "upcoming" | "past" | "cancelled";

const deriveClientStatus = (booking: Pick<RestaurantBooking, "status" | "date" | "time">): BookingClientStatus => {
  if (booking.status === "CANCELLED") return "cancelled";
  return combineDateAndTime(booking.date, booking.time).getTime() < Date.now() ? "past" : "upcoming";
};

export const toBookingResponse = (booking: RestaurantBooking & { table?: any; preorder?: any }) => ({
  id: booking.id,
  humanBookingId: booking.humanBookingId,
  restaurantId: booking.restaurantId,
  restaurantName: booking.restaurantNameSnapshot,
  restaurantImage: resolveAssetUrl(booking.restaurantImageSnapshot ?? undefined) ?? null,
  rating: Number(booking.ratingSnapshot),
  cuisineLabel: booking.cuisineLabelSnapshot,
  distanceKm: booking.distanceKmSnapshot !== null ? Number(booking.distanceKmSnapshot) : null,
  date: formatDateOnly(booking.date),
  time: to12Hour(booking.time),
  people: booking.people,
  tablePreference: TABLE_PREFERENCE_LABELS[booking.tablePreference],
  specialRequest: booking.specialRequest ?? "",
  fullName: booking.fullName,
  mobileNumber: booking.mobileNumber,
  email: booking.email ?? "",
  status: deriveClientStatus(booking),
  cancellationReason: booking.cancellationReason ? CANCELLATION_REASON_LABELS[booking.cancellationReason] : null,
  advancePaid: Number(booking.advancePaid),
  table: booking.table ? { id: booking.table.id, name: booking.table.name, capacity: booking.table.capacity, preference: booking.table.preference, section: booking.table.section } : null,
  preorder: booking.preorder ? { id: booking.preorder.id, subtotal: Number(booking.preorder.subtotal), total: Number(booking.preorder.total), items: booking.preorder.items?.map((item: any) => ({ id: item.id, menuItemId: item.menuItemId, name: item.itemName, unitPrice: Number(item.unitPrice), quantity: item.quantity, note: item.note, lineTotal: Number(item.lineTotal) })) ?? [] } : null,
  refund:
    booking.status === "CANCELLED"
      ? { eligible: booking.refundEligible ?? false, amount: booking.refundAmount ? Number(booking.refundAmount) : 0 }
      : undefined,
});

export type CreateBookingInput = {
  date: string;
  time: string;
  people: number;
  /** Table booking disabled — optional, defaults to "Any Table". */
  tablePreference?: string;
  specialRequest?: string;
  fullName: string;
  mobileNumber: string;
  email?: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  latitude?: number;
  longitude?: number;
  // tableId?: string; // Table booking disabled
  /** Menu items ordered with this booking — required, and their total is what the customer paid. */
  preorderItems: Array<{ menuItemId: string; quantity: number; note?: string }>;
};

const bookingInclude = { table: true, preorder: { include: { items: true } } } as const;

const preparePreorder = async (client: any, restaurantId: string, items: CreateBookingInput["preorderItems"] = []) => {
  if (!items?.length) return null;
  const uniqueIds = [...new Set(items.map((item) => item.menuItemId))];
  const menuItems: any[] = await client.menuItem.findMany({ where: { id: { in: uniqueIds }, isActive: true, menuCategory: { restaurantId, isActive: true } } });
  if (menuItems.length !== uniqueIds.length) throw new ApiError(422, "One or more pre-order menu items are unavailable.");
  const byId = new Map(menuItems.map((item: any) => [item.id, item]));
  return items.map((item) => {
    const menuItem = byId.get(item.menuItemId)!;
    const unitPrice = Number(menuItem.price);
    return { menuItemId: menuItem.id, itemName: menuItem.name, unitPrice, quantity: item.quantity, note: item.note, lineTotal: Math.round(unitPrice * item.quantity * 100) / 100 };
  });
};

const assertValidDate = (value: string) => {
  let date: Date;
  try {
    date = parseDateOnly(value);
  } catch {
    throw new ApiError(422, "Invalid date. Use YYYY-MM-DD format.");
  }
  if (!isWithinBookingWindow(date)) throw new ApiError(422, "Date must be between today and 60 days from now.");
  return date;
};

const assertValidTime = (value: string) => {
  if (!isValidTime12(value)) throw new ApiError(422, 'Invalid time format. Use e.g. "12:00 PM".');
  return to24Hour(value);
};

export const createBooking = async (customerId: string, restaurantId: string, input: CreateBookingInput) => {
  const restaurant = await getActiveRestaurantOrThrow(restaurantId);
  const date = assertValidDate(input.date);
  const time24 = assertValidTime(input.time);

  const slot = await prisma.slotConfiguration.findFirst({ where: { restaurantId, time: time24, isActive: true } });
  if (!slot) throw new ApiError(422, "Selected slot is not available for this restaurant.");

  if (!Number.isInteger(input.people) || input.people < 1 || input.people > restaurant.maxPartySize) {
    throw new ApiError(422, `people must be between 1 and ${restaurant.maxPartySize}.`);
  }

  const tablePreference = TABLE_PREFERENCE_BY_LABEL[input.tablePreference ?? TABLE_PREFERENCE_LABELS.ANY];
  if (!tablePreference) throw new ApiError(422, "Invalid tablePreference.");
  if (!input.preorderItems?.length) throw new ApiError(422, "Select at least one menu item.");

  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: input.razorpayOrderId } });
  if (!payment || payment.restaurantUserId !== customerId) throw new ApiError(404, "Payment order not found.");
  if (payment.status !== "VERIFIED") throw new ApiError(402, "Payment has not been verified.");
  if (payment.razorpayPaymentId !== input.razorpayPaymentId) throw new ApiError(400, "Payment id mismatch.");

  const alreadyUsed = await prisma.restaurantBooking.findUnique({ where: { paymentId: payment.id } });
  if (alreadyUsed) throw new ApiError(409, "This payment has already been used for a booking.");

  // The payment was created for a specific basket; the booking must carry the same basket total,
  // otherwise a customer could pay for one item and book with more.
  const orderTotal = await calculateMenuTotal(prisma, restaurantId, input.preorderItems);
  if (Math.abs(orderTotal - Number(payment.amount)) > 0.009) {
    throw new ApiError(409, "Selected menu items do not match the paid amount. Please pay again.");
  }

  const distanceKm =
    input.latitude !== undefined && input.longitude !== undefined
      ? haversineDistanceKm({ latitude: input.latitude, longitude: input.longitude }, { latitude: Number(restaurant.latitude), longitude: Number(restaurant.longitude) })
      : null;

  const booking = await prisma.$transaction(async (tx) => {
    // Row lock on the restaurant serializes concurrent booking attempts for the same
    // restaurant/date/time so the capacity re-check below can't race.
    await tx.$queryRaw`SELECT id FROM restaurants WHERE id = ${restaurantId} FOR UPDATE`;
    // Table booking disabled — capacity-only check.
    // const selection = await findAvailableTable(tx, { restaurantId, date, time: time24, people: input.people, preference: tablePreference, tableId: input.tableId });
    // if (selection.hasTables && !selection.table) throw new ApiError(409, "No suitable table is available for this slot.");
    const booked = await getBookedSeatCount(tx, { restaurantId, date, time: time24 });
    if (restaurant.seatingCapacity - booked < input.people) throw new ApiError(409, "Selected slot no longer has enough capacity.");
    const preorderItems = await preparePreorder(tx, restaurantId, input.preorderItems);
    return tx.restaurantBooking.create({
      data: {
        humanBookingId: generateHumanBookingId(restaurant.name),
        restaurantId,
        restaurantUserId: customerId,
        restaurantNameSnapshot: restaurant.name,
        restaurantImageSnapshot: restaurant.banner,
        ratingSnapshot: restaurant.rating,
        cuisineLabelSnapshot: restaurant.cuisineLabel,
        distanceKmSnapshot: distanceKm,
        date,
        time: time24,
        people: input.people,
        tablePreference,
        specialRequest: input.specialRequest,
        fullName: input.fullName,
        mobileNumber: input.mobileNumber,
        email: input.email,
        advancePaid: payment.amount,
        paymentId: payment.id,
        // tableId: selection.table?.id, // Table booking disabled
        ...(preorderItems ? { preorder: { create: { subtotal: preorderItems.reduce((sum, item) => sum + item.lineTotal, 0), total: preorderItems.reduce((sum, item) => sum + item.lineTotal, 0), items: { create: preorderItems } } } } : {}),
      },
      include: bookingInclude,
    });
  });

  const reminderAt = new Date(combineDateAndTime(date, time24).getTime() - policy.reminderMinutesBefore * 60_000);
  const reminderJobId = await scheduleReminder(booking.id, reminderAt);
  if (reminderJobId) {
    await prisma.restaurantBooking.update({ where: { id: booking.id }, data: { reminderJobId } });
  }

  await notifyCustomer({
    restaurantUserId: customerId,
    type: "BOOKING_CONFIRMED",
    bookingId: booking.id,
    title: "Booking confirmed",
    body: `Your booking at ${restaurant.name} on ${input.date} at ${input.time} is confirmed.`,
  });
  emitToRestaurant(restaurantId, socketEvents.bookingNew, booking);

  return toBookingResponse(booking);
};

export const listMyBookings = async (customerId: string, filter?: "upcoming" | "past") => {
  const bookings = await prisma.restaurantBooking.findMany({
    where: { restaurantUserId: customerId },
    orderBy: [{ date: "desc" }, { time: "desc" }],
    include: bookingInclude,
  });
  const mapped = bookings.map(toBookingResponse);
  if (!filter) return mapped;
  return mapped.filter((booking) => (filter === "upcoming" ? booking.status === "upcoming" : booking.status !== "upcoming"));
};

export const getBookingForCustomer = async (customerId: string, id: string) => {
  const booking = await prisma.restaurantBooking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.restaurantUserId !== customerId) throw new ApiError(403, "You do not have access to this booking");
  return toBookingResponse(booking);
};

export type ModifyBookingInput = { date?: string; time?: string; people?: number };

export const modifyBooking = async (customerId: string, id: string, input: ModifyBookingInput) => {
  const existing = await prisma.restaurantBooking.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Booking not found");
  if (existing.restaurantUserId !== customerId) throw new ApiError(403, "You do not have access to this booking");
  if (existing.status === "CANCELLED") throw new ApiError(409, "Cancelled bookings cannot be modified");

  const currentSlotDateTime = combineDateAndTime(existing.date, existing.time);
  if (currentSlotDateTime.getTime() < Date.now()) throw new ApiError(409, "Past bookings cannot be modified");

  const minutesUntilSlot = (currentSlotDateTime.getTime() - Date.now()) / 60_000;
  if (minutesUntilSlot < policy.modificationCutoffMinutes) {
    throw new ApiError(409, `Bookings can only be modified up to ${policy.modificationCutoffMinutes} minutes before the slot time.`);
  }

  const restaurant = await getActiveRestaurantOrThrow(existing.restaurantId);
  const nextDate = input.date ? assertValidDate(input.date) : existing.date;
  const nextTime24 = input.time ? assertValidTime(input.time) : existing.time;

  const slot = await prisma.slotConfiguration.findFirst({ where: { restaurantId: existing.restaurantId, time: nextTime24, isActive: true } });
  if (!slot) throw new ApiError(422, "Selected slot is not available for this restaurant.");

  const nextPeople = input.people ?? existing.people;
  if (!Number.isInteger(nextPeople) || nextPeople < 1 || nextPeople > restaurant.maxPartySize) {
    throw new ApiError(422, `people must be between 1 and ${restaurant.maxPartySize}.`);
  }

  const newSlotDateTime = combineDateAndTime(nextDate, nextTime24);
  if (newSlotDateTime.getTime() < Date.now()) throw new ApiError(422, "Cannot move a booking into the past.");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM restaurants WHERE id = ${existing.restaurantId} FOR UPDATE`;
    const booked = await getBookedSeatCount(tx, {
      restaurantId: existing.restaurantId,
      date: nextDate,
      time: nextTime24,
      excludeBookingId: existing.id,
    });
    if (restaurant.seatingCapacity - booked < nextPeople) {
      throw new ApiError(409, "Selected slot no longer has enough capacity.");
    }
    // Table booking disabled — capacity check above is the only availability rule.
    // const selection = await findAvailableTable(tx, { restaurantId: existing.restaurantId, date: nextDate, time: nextTime24, people: nextPeople, preference: existing.tablePreference, tableId: existing.tableId ?? undefined, excludeBookingId: existing.id });
    // if (selection.hasTables && !selection.table) throw new ApiError(409, "No suitable table is available for this slot.");
    return tx.restaurantBooking.update({ where: { id }, data: { date: nextDate, time: nextTime24, people: nextPeople }, include: bookingInclude });
  });

  await cancelReminder(existing.reminderJobId);
  const reminderAt = new Date(newSlotDateTime.getTime() - policy.reminderMinutesBefore * 60_000);
  const reminderJobId = await scheduleReminder(updated.id, reminderAt);
  await prisma.restaurantBooking.update({ where: { id: updated.id }, data: { reminderJobId } });

  await notifyCustomer({
    restaurantUserId: customerId,
    type: "BOOKING_MODIFIED",
    bookingId: updated.id,
    title: "Booking updated",
    body: `Your booking ${updated.humanBookingId} has been updated to ${formatDateOnly(nextDate)} at ${to12Hour(nextTime24)}.`,
  });
  emitToRestaurant(existing.restaurantId, socketEvents.bookingModified, updated);

  return toBookingResponse(updated);
};

export const cancelBooking = async (customerId: string, id: string, reasonLabel: string) => {
  const reason = CANCELLATION_REASON_BY_LABEL[reasonLabel];
  if (!reason) throw new ApiError(422, "Invalid cancellation reason.");

  const existing = await prisma.restaurantBooking.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Booking not found");
  if (existing.restaurantUserId !== customerId) throw new ApiError(403, "You do not have access to this booking");
  if (existing.status === "CANCELLED") throw new ApiError(409, "Booking is already cancelled");

  const slotDateTime = combineDateAndTime(existing.date, existing.time);
  if (slotDateTime.getTime() < Date.now()) throw new ApiError(409, "Past bookings cannot be cancelled");

  const refund = decideRefund({ advancePaid: Number(existing.advancePaid), slotDateTime });

  const updated = await prisma.restaurantBooking.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancellationReason: reason,
      cancelledAt: new Date(),
      refundEligible: refund.eligible,
      refundAmount: refund.amount,
    },
  });

  await cancelReminder(existing.reminderJobId);
  await notifyCustomer({
    restaurantUserId: customerId,
    type: "BOOKING_CANCELLED",
    bookingId: updated.id,
    title: "Booking cancelled",
    body: `Your booking ${updated.humanBookingId} has been cancelled.`,
  });
  emitToRestaurant(existing.restaurantId, socketEvents.bookingCancelled, updated);

  return { booking: toBookingResponse(updated), refund };
};

export const listBookingsForAdmin = async (input: { restaurantId?: string; restaurantIds?: string[]; status?: BookingClientStatus; page: number; limit: number }) => {
  const bookings = await prisma.restaurantBooking.findMany({
    where: input.restaurantId ? { restaurantId: input.restaurantId } : input.restaurantIds ? { restaurantId: { in: input.restaurantIds } } : {},
    orderBy: [{ date: "desc" }, { time: "desc" }],
    include: bookingInclude,
  });
  let mapped = bookings.map(toBookingResponse);
  if (input.status) mapped = mapped.filter((booking) => booking.status === input.status);

  const total = mapped.length;
  const start = (input.page - 1) * input.limit;
  return { bookings: mapped.slice(start, start + input.limit), total };
};

export const getBookingForAdmin = async (id: string) => {
  const booking = await prisma.restaurantBooking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking) throw new ApiError(404, "Booking not found");
  return { booking: toBookingResponse(booking), restaurantId: booking.restaurantId };
};

const assertPreorderEditable = async (customerId: string, bookingId: string) => {
  const booking = await prisma.restaurantBooking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!booking) throw new ApiError(404, "Booking not found");
  if (booking.restaurantUserId !== customerId) throw new ApiError(403, "You do not have access to this booking");
  if (booking.status === "CANCELLED") throw new ApiError(409, "Cancelled bookings cannot be changed");
  const minutesUntilSlot = (combineDateAndTime(booking.date, booking.time).getTime() - Date.now()) / 60_000;
  if (minutesUntilSlot < policy.modificationCutoffMinutes) throw new ApiError(409, `Bookings can only be modified up to ${policy.modificationCutoffMinutes} minutes before the slot time.`);
  return booking;
};

export const getPreorderForCustomer = async (customerId: string, bookingId: string) => {
  const booking = await getBookingForCustomer(customerId, bookingId);
  return booking.preorder ?? { items: [], subtotal: 0, total: 0 };
};

export const replacePreorderForCustomer = async (customerId: string, bookingId: string, items: NonNullable<CreateBookingInput["preorderItems"]>) => {
  const booking = await assertPreorderEditable(customerId, bookingId);
  const rows = await preparePreorder(prisma, booking.restaurantId, items);
  const subtotal = rows?.reduce((sum, item) => sum + item.lineTotal, 0) ?? 0;
  await prisma.$transaction(async (tx) => {
    await tx.bookingPreorder.deleteMany({ where: { bookingId } });
    if (rows?.length) await tx.bookingPreorder.create({ data: { bookingId, subtotal, total: subtotal, items: { create: rows } } });
  });
  return getPreorderForCustomer(customerId, bookingId);
};

export const removePreorderItemForCustomer = async (customerId: string, bookingId: string, itemId: string) => {
  await assertPreorderEditable(customerId, bookingId);
  const item = await prisma.bookingPreorderItem.findFirst({ where: { id: itemId, preorder: { bookingId } } });
  if (!item) throw new ApiError(404, "Pre-order item not found");
  await prisma.$transaction(async (tx) => {
    await tx.bookingPreorderItem.delete({ where: { id: itemId } });
    const remaining = await tx.bookingPreorderItem.aggregate({ where: { preorderId: item.preorderId }, _sum: { lineTotal: true } });
    const total = Number(remaining._sum.lineTotal ?? 0);
    await tx.bookingPreorder.update({ where: { id: item.preorderId }, data: { subtotal: total, total } });
  });
  return getPreorderForCustomer(customerId, bookingId);
};

/** Admin-initiated cancellation — same rules as the customer path minus the ownership check. */
export const adminCancelBooking = async (id: string, reasonLabel: string) => {
  const reason = CANCELLATION_REASON_BY_LABEL[reasonLabel] ?? "OTHER";
  const existing = await prisma.restaurantBooking.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Booking not found");
  if (existing.status === "CANCELLED") throw new ApiError(409, "Booking is already cancelled");

  const slotDateTime = combineDateAndTime(existing.date, existing.time);
  const refund = decideRefund({ advancePaid: Number(existing.advancePaid), slotDateTime });

  const updated = await prisma.restaurantBooking.update({
    where: { id },
    data: { status: "CANCELLED", cancellationReason: reason, cancelledAt: new Date(), refundEligible: refund.eligible, refundAmount: refund.amount },
  });

  await cancelReminder(existing.reminderJobId);
  await notifyCustomer({
    restaurantUserId: existing.restaurantUserId,
    type: "BOOKING_CANCELLED",
    bookingId: updated.id,
    title: "Booking cancelled",
    body: `Your booking ${updated.humanBookingId} has been cancelled by the restaurant.`,
  });
  emitToRestaurant(existing.restaurantId, socketEvents.bookingCancelled, updated);

  return { booking: toBookingResponse(updated), refund, restaurantId: existing.restaurantId };
};
