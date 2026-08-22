import type { BookingStatus, Prisma, StayChargeType } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { adapterSyncQueue, bookingExpirationQueue, notificationQueue } from "../queues/bookingQueues.js";
import { deletePendingBookingMetadata, savePendingBookingMetadata } from "../redis/bookingMetadata.js";
import { findBookingForLifecycle, writeBookingEvent } from "../repositories/bookingRepository.js";
import { emitToProperty } from "../socket/server.js";
import { socketEvents } from "../socket/socketEvents.js";
import { ApiError } from "../utils/http.js";
import { eachBookedNight } from "../utils/dates.js";
import { assertRoomOpenForDates, bookingInclude, lockBookingDates, nextBookingRef, unlockBookingDates } from "./bookingService.js";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN"];
const isEditable = (status: BookingStatus) => ACTIVE_BOOKING_STATUSES.includes(status);

const EXPIRATION_MS = 5 * 60 * 1000;
type LifecycleBooking = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

type Actor = {
  type: "OWNER" | "ADMIN" | "ADAPTER" | "SYSTEM";
  id?: string;
};

export type CreatePendingBookingInput = {
  stayProfileId: string;
  roomId: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  checkInDate: Date;
  checkOutDate: Date;
  noOfGuests: number;
  totalAmount: number;
  paymentStatus?: "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";
  source?: "DIRECT_SITE" | "PHONE" | "WALK_IN" | "ADMIN_ADDED" | "SAAS_ADAPTER";
  notes?: string;
};

const bookingDelay = (expiresAt: Date) => Math.max(0, expiresAt.getTime() - Date.now());

const enqueueBookingSideEffects = async (booking: LifecycleBooking) => {
  if (!booking.stayProfile) return;
  await savePendingBookingMetadata({
    bookingId: booking.id,
    bookingRef: booking.bookingRef,
    propertyId: booking.stayProfileId,
    ownerId: booking.stayProfile.ownerId,
    expiresAt: booking.expiresAt?.toISOString() ?? new Date(Date.now() + EXPIRATION_MS).toISOString(),
  });
  await bookingExpirationQueue.add(
    "expire-booking",
    { bookingId: booking.id },
    { jobId: `expire-${booking.id}`, delay: bookingDelay(booking.expiresAt ?? new Date(Date.now() + EXPIRATION_MS)), attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: true },
  );
  await notificationQueue.add("booking-created", { bookingId: booking.id }, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  emitToProperty(booking.stayProfileId, socketEvents.bookingNew, booking);
};

export const createPendingBooking = async (input: CreatePendingBookingInput) => {
  await assertRoomOpenForDates(input.roomId, input.checkInDate, input.checkOutDate);
  const expiresAt = new Date(Date.now() + EXPIRATION_MS);
  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        bookingRef: nextBookingRef(),
        stayProfileId: input.stayProfileId,
        roomId: input.roomId,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        noOfGuests: input.noOfGuests,
        totalAmount: input.totalAmount,
        bookingStatus: "PENDING",
        paymentStatus: input.paymentStatus ?? "UNPAID",
        source: input.source ?? "SAAS_ADAPTER",
        notes: input.notes,
        expiresAt,
        ownerResponseDeadline: expiresAt,
      },
      include: bookingInclude,
    });
    await writeBookingEvent(tx, {
      bookingId: created.id,
      type: "CREATED",
      toStatus: "PENDING",
      actorType: input.source === "SAAS_ADAPTER" ? "ADAPTER" : "SYSTEM",
      metadata: { expiresAt: expiresAt.toISOString() },
    });
    return created;
  });

  await enqueueBookingSideEffects(booking);
  return booking;
};

export const createConfirmedBooking = async (input: CreatePendingBookingInput, actor: Actor) => {
  const booking = await prisma.$transaction(async (tx) => {
    await assertRoomOpenForDates(input.roomId, input.checkInDate, input.checkOutDate, tx);
    const created = await tx.booking.create({
      data: {
        bookingRef: nextBookingRef(),
        stayProfileId: input.stayProfileId,
        roomId: input.roomId,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        noOfGuests: input.noOfGuests,
        totalAmount: input.totalAmount,
        bookingStatus: "CONFIRMED",
        paymentStatus: input.paymentStatus ?? "UNPAID",
        source: input.source ?? "ADMIN_ADDED",
        notes: input.notes,
        confirmedAt: new Date(),
        respondedAt: new Date(),
      },
      include: bookingInclude,
    });
    await lockBookingDates(tx, created.id, created.roomId, created.checkInDate, created.checkOutDate);
    await writeBookingEvent(tx, {
      bookingId: created.id,
      type: "CREATED",
      toStatus: "CONFIRMED",
      actorType: actor.type,
      actorId: actor.id,
    });
    await writeBookingEvent(tx, {
      bookingId: created.id,
      type: "CONFIRMED",
      toStatus: "CONFIRMED",
      actorType: actor.type,
      actorId: actor.id,
    });
    return findBookingForLifecycle(tx, created.id);
  });

  if (!booking) throw new ApiError(404, "Booking not found");
  await notificationQueue.add("booking-confirmed", { bookingId: booking.id }, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  emitToProperty(booking.stayProfileId, socketEvents.bookingConfirmed, booking);
  return booking;
};

const ensureOpenDatesForConfirm = async (tx: Prisma.TransactionClient, bookingId: string, roomId: string, checkInDate: Date, checkOutDate: Date) => {
  const { eachBookedNight } = await import("../utils/dates.js");
  const dates = eachBookedNight(checkInDate, checkOutDate);
  const blocked = await tx.roomAvailability.findMany({
    where: {
      roomId,
      date: { in: dates },
      status: { in: ["UNAVAILABLE", "BOOKED"] },
      OR: [{ bookingId: null }, { bookingId: { not: bookingId } }],
    },
  });
  if (blocked.length) {
    throw new ApiError(409, "Room is no longer available for this booking");
  }

  const blockedRanges = await tx.roomBlock.findMany({
    where: { roomId, startDate: { lt: checkOutDate }, endDate: { gt: checkInDate } },
  });
  if (blockedRanges.length) {
    throw new ApiError(409, "Room is blocked for this booking's dates");
  }
};

export const confirmBooking = async (bookingId: string, actor: Actor) => {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await findBookingForLifecycle(tx, bookingId);
    if (!existing) throw new ApiError(404, "Booking not found");
    if (existing.bookingStatus !== "PENDING") throw new ApiError(409, `Booking is already ${existing.bookingStatus}`);
    await ensureOpenDatesForConfirm(tx, existing.id, existing.roomId, existing.checkInDate, existing.checkOutDate);
    await lockBookingDates(tx, existing.id, existing.roomId, existing.checkInDate, existing.checkOutDate);
    const updatedCount = await tx.booking.updateMany({
      where: { id: existing.id, version: existing.version, bookingStatus: "PENDING" },
      data: { bookingStatus: "CONFIRMED", confirmedAt: new Date(), respondedAt: new Date(), version: { increment: 1 } },
    });
    if (updatedCount.count !== 1) throw new ApiError(409, "Booking was changed by another request");
    await writeBookingEvent(tx, {
      bookingId: existing.id,
      type: "CONFIRMED",
      fromStatus: "PENDING",
      toStatus: "CONFIRMED",
      actorType: actor.type,
      actorId: actor.id,
    });
    return findBookingForLifecycle(tx, existing.id);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  await deletePendingBookingMetadata(booking.id);
  await adapterSyncQueue.add("booking-confirmed", { bookingId: booking.id }, { attempts: 6, backoff: { type: "exponential", delay: 10000 } });
  await notificationQueue.add("booking-confirmed", { bookingId: booking.id }, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  emitToProperty(booking.stayProfileId, socketEvents.bookingConfirmed, booking);
  return booking;
};

export const rejectBooking = async (
  bookingId: string,
  actor: Actor,
  status: Extract<BookingStatus, "REJECTED" | "CANCELLED"> = "REJECTED",
  options: { syncAdapter?: boolean } = {},
) => {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await findBookingForLifecycle(tx, bookingId);
    if (!existing) throw new ApiError(404, "Booking not found");
    if (!["PENDING", "CONFIRMED"].includes(existing.bookingStatus)) throw new ApiError(409, `Booking is already ${existing.bookingStatus}`);
    if (existing.bookingStatus === "CONFIRMED") await unlockBookingDates(tx, existing.id);
    const updatedCount = await tx.booking.updateMany({
      where: { id: existing.id, version: existing.version, bookingStatus: existing.bookingStatus },
      data: { bookingStatus: status, cancelledAt: new Date(), respondedAt: new Date(), version: { increment: 1 } },
    });
    if (updatedCount.count !== 1) throw new ApiError(409, "Booking was changed by another request");
    await writeBookingEvent(tx, {
      bookingId: existing.id,
      type: status,
      fromStatus: existing.bookingStatus,
      toStatus: status,
      actorType: actor.type,
      actorId: actor.id,
    });
    return findBookingForLifecycle(tx, existing.id);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  await deletePendingBookingMetadata(booking.id);
  if (options.syncAdapter ?? true) {
    await adapterSyncQueue.add("booking-cancelled", { bookingId: booking.id, status }, { attempts: 6, backoff: { type: "exponential", delay: 10000 } });
  }
  await notificationQueue.add("booking-cancelled", { bookingId: booking.id, status }, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  emitToProperty(booking.stayProfileId, socketEvents.bookingCancelled, booking);
  return booking;
};

const stayCharge = (type: StayChargeType, manualCharge: number | undefined, nightlyRate: number) => {
  if (type === "FULL") return nightlyRate;
  if (type === "MANUAL") return Math.max(0, manualCharge ?? 0);
  return 0;
};

export const checkInBooking = async (
  bookingId: string,
  actor: Actor,
  input: { earlyCheckinType: StayChargeType; earlyCheckinCharge?: number },
) => {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await findBookingForLifecycle(tx, bookingId);
    if (!existing) throw new ApiError(404, "Booking not found");
    if (existing.bookingStatus !== "CONFIRMED") throw new ApiError(409, `Booking must be confirmed before check-in (currently ${existing.bookingStatus})`);
    const charge = stayCharge(input.earlyCheckinType, input.earlyCheckinCharge, Number(existing.room.basePrice));
    const updatedCount = await tx.booking.updateMany({
      where: { id: existing.id, version: existing.version, bookingStatus: "CONFIRMED" },
      data: {
        bookingStatus: "CHECKED_IN",
        checkedInAt: new Date(),
        earlyCheckinType: input.earlyCheckinType,
        earlyCheckinCharge: charge > 0 ? charge : null,
        totalAmount: { increment: charge },
        version: { increment: 1 },
      },
    });
    if (updatedCount.count !== 1) throw new ApiError(409, "Booking was changed by another request");
    await writeBookingEvent(tx, {
      bookingId: existing.id,
      type: "CHECKED_IN",
      fromStatus: "CONFIRMED",
      toStatus: "CHECKED_IN",
      actorType: actor.type,
      actorId: actor.id,
      metadata: { earlyCheckinType: input.earlyCheckinType, charge },
    });
    return findBookingForLifecycle(tx, existing.id);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  emitToProperty(booking.stayProfileId, socketEvents.bookingCheckedIn, booking);
  return booking;
};

export const checkOutBooking = async (
  bookingId: string,
  actor: Actor,
  input: { lateCheckoutType: StayChargeType; lateCheckoutCharge?: number },
) => {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await findBookingForLifecycle(tx, bookingId);
    if (!existing) throw new ApiError(404, "Booking not found");
    if (existing.bookingStatus !== "CHECKED_IN") throw new ApiError(409, `Booking must be checked in before check-out (currently ${existing.bookingStatus})`);
    const charge = stayCharge(input.lateCheckoutType, input.lateCheckoutCharge, Number(existing.room.basePrice));
    const updatedCount = await tx.booking.updateMany({
      where: { id: existing.id, version: existing.version, bookingStatus: "CHECKED_IN" },
      data: {
        bookingStatus: "COMPLETED",
        checkedOutAt: new Date(),
        lateCheckoutType: input.lateCheckoutType,
        lateCheckoutCharge: charge > 0 ? charge : null,
        totalAmount: { increment: charge },
        version: { increment: 1 },
      },
    });
    if (updatedCount.count !== 1) throw new ApiError(409, "Booking was changed by another request");
    await writeBookingEvent(tx, {
      bookingId: existing.id,
      type: "CHECKED_OUT",
      fromStatus: "CHECKED_IN",
      toStatus: "COMPLETED",
      actorType: actor.type,
      actorId: actor.id,
      metadata: { lateCheckoutType: input.lateCheckoutType, charge },
    });
    return findBookingForLifecycle(tx, existing.id);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  emitToProperty(booking.stayProfileId, socketEvents.bookingCheckedOut, booking);
  return booking;
};

export const extendBookingStay = async (
  bookingId: string,
  actor: Actor,
  input: { checkOutDate: Date; totalAmount: number },
) => {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await findBookingForLifecycle(tx, bookingId);
    if (!existing) throw new ApiError(404, "Booking not found");
    if (!["CONFIRMED", "CHECKED_IN"].includes(existing.bookingStatus)) throw new ApiError(409, `Cannot extend a ${existing.bookingStatus} booking`);
    if (input.checkOutDate <= existing.checkOutDate) throw new ApiError(422, "New check-out date must be after the current check-out date");
    await assertRoomOpenForDates(existing.roomId, existing.checkOutDate, input.checkOutDate, tx);
    const previousCheckOutDate = existing.checkOutDate;
    const updatedCount = await tx.booking.updateMany({
      where: { id: existing.id, version: existing.version },
      data: { checkOutDate: input.checkOutDate, totalAmount: input.totalAmount, version: { increment: 1 } },
    });
    if (updatedCount.count !== 1) throw new ApiError(409, "Booking was changed by another request");
    await lockBookingDates(tx, existing.id, existing.roomId, previousCheckOutDate, input.checkOutDate);
    await writeBookingEvent(tx, {
      bookingId: existing.id,
      type: "EXTENDED",
      actorType: actor.type,
      actorId: actor.id,
      metadata: { previousCheckOutDate: previousCheckOutDate.toISOString(), newCheckOutDate: input.checkOutDate.toISOString() },
    });
    return findBookingForLifecycle(tx, existing.id);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  emitToProperty(booking.stayProfileId, socketEvents.bookingExtended, booking);
  return booking;
};

export const addBookingCharge = async (bookingId: string, actor: Actor, input: { label: string; amount: number }) => {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await findBookingForLifecycle(tx, bookingId);
    if (!existing) throw new ApiError(404, "Booking not found");
    if (!isEditable(existing.bookingStatus)) throw new ApiError(409, `Cannot add a charge to a ${existing.bookingStatus} booking`);
    await tx.bookingCharge.create({ data: { bookingId, label: input.label, amount: input.amount, actorType: actor.type, actorId: actor.id } });
    await tx.booking.update({ where: { id: bookingId }, data: { totalAmount: { increment: input.amount }, version: { increment: 1 } } });
    await writeBookingEvent(tx, { bookingId, type: "CHARGE_ADDED", actorType: actor.type, actorId: actor.id, metadata: { label: input.label, amount: input.amount } });
    return findBookingForLifecycle(tx, bookingId);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  return booking;
};

export const removeBookingCharge = async (bookingId: string, chargeId: string, actor: Actor) => {
  const booking = await prisma.$transaction(async (tx) => {
    const charge = await tx.bookingCharge.findUnique({ where: { id: chargeId } });
    if (!charge || charge.bookingId !== bookingId) throw new ApiError(404, "Charge not found");
    await tx.bookingCharge.delete({ where: { id: chargeId } });
    await tx.booking.update({ where: { id: bookingId }, data: { totalAmount: { decrement: charge.amount }, version: { increment: 1 } } });
    await writeBookingEvent(tx, { bookingId, type: "CHARGE_REMOVED", actorType: actor.type, actorId: actor.id, metadata: { label: charge.label, amount: Number(charge.amount) } });
    return findBookingForLifecycle(tx, bookingId);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  return booking;
};

export const addBookingService = async (bookingId: string, actor: Actor, input: { serviceId: string; quantity: number }) => {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await findBookingForLifecycle(tx, bookingId);
    if (!existing) throw new ApiError(404, "Booking not found");
    if (!isEditable(existing.bookingStatus)) throw new ApiError(409, `Cannot add a service to a ${existing.bookingStatus} booking`);
    const service = await tx.service.findFirst({ where: { id: input.serviceId, propertyId: existing.stayProfileId } });
    if (!service) throw new ApiError(404, "Service not found for this property");
    const lineTotal = Number(service.price) * input.quantity;
    await tx.bookingService.create({ data: { bookingId, serviceId: service.id, title: service.title, price: service.price, quantity: input.quantity } });
    await tx.booking.update({ where: { id: bookingId }, data: { totalAmount: { increment: lineTotal }, version: { increment: 1 } } });
    await writeBookingEvent(tx, { bookingId, type: "SERVICE_ADDED", actorType: actor.type, actorId: actor.id, metadata: { title: service.title, quantity: input.quantity } });
    return findBookingForLifecycle(tx, bookingId);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  return booking;
};

export const updateBookingServiceQuantity = async (bookingId: string, bookingServiceId: string, actor: Actor, quantity: number) => {
  const booking = await prisma.$transaction(async (tx) => {
    const line = await tx.bookingService.findUnique({ where: { id: bookingServiceId } });
    if (!line || line.bookingId !== bookingId) throw new ApiError(404, "Service line not found");
    const delta = (quantity - line.quantity) * Number(line.price);
    await tx.bookingService.update({ where: { id: bookingServiceId }, data: { quantity } });
    await tx.booking.update({ where: { id: bookingId }, data: { totalAmount: { increment: delta }, version: { increment: 1 } } });
    await writeBookingEvent(tx, { bookingId, type: "SERVICE_UPDATED", actorType: actor.type, actorId: actor.id, metadata: { title: line.title, quantity } });
    return findBookingForLifecycle(tx, bookingId);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  return booking;
};

export const removeBookingService = async (bookingId: string, bookingServiceId: string, actor: Actor) => {
  const booking = await prisma.$transaction(async (tx) => {
    const line = await tx.bookingService.findUnique({ where: { id: bookingServiceId } });
    if (!line || line.bookingId !== bookingId) throw new ApiError(404, "Service line not found");
    const lineTotal = Number(line.price) * line.quantity;
    await tx.bookingService.delete({ where: { id: bookingServiceId } });
    await tx.booking.update({ where: { id: bookingId }, data: { totalAmount: { decrement: lineTotal }, version: { increment: 1 } } });
    await writeBookingEvent(tx, { bookingId, type: "SERVICE_REMOVED", actorType: actor.type, actorId: actor.id, metadata: { title: line.title } });
    return findBookingForLifecycle(tx, bookingId);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  return booking;
};

export const changeBookingRatePlan = async (bookingId: string, actor: Actor, input: { ratePlanId: string | null; totalAmount: number }) => {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await findBookingForLifecycle(tx, bookingId);
    if (!existing) throw new ApiError(404, "Booking not found");
    if (!isEditable(existing.bookingStatus)) throw new ApiError(409, `Cannot change the rate plan for a ${existing.bookingStatus} booking`);
    if (input.ratePlanId) {
      const ratePlan = await tx.ratePlan.findFirst({ where: { id: input.ratePlanId, propertyId: existing.stayProfileId } });
      if (!ratePlan) throw new ApiError(404, "Rate plan not found for this property");
    }
    await tx.booking.update({ where: { id: bookingId }, data: { ratePlanId: input.ratePlanId, totalAmount: input.totalAmount, version: { increment: 1 } } });
    await writeBookingEvent(tx, { bookingId, type: "RATE_PLAN_CHANGED", actorType: actor.type, actorId: actor.id, metadata: { ratePlanId: input.ratePlanId, totalAmount: input.totalAmount } });
    return findBookingForLifecycle(tx, bookingId);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  return booking;
};

export const addBookingGuest = async (bookingId: string, actor: Actor, input: { name: string; phone?: string; email?: string }) => {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!existing) throw new ApiError(404, "Booking not found");
    await tx.bookingGuest.create({ data: { bookingId, name: input.name, phone: input.phone, email: input.email } });
    await writeBookingEvent(tx, { bookingId, type: "GUEST_ADDED", actorType: actor.type, actorId: actor.id, metadata: { name: input.name } });
    return findBookingForLifecycle(tx, bookingId);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  return booking;
};

export const updateBookingGuest = async (bookingId: string, guestId: string, actor: Actor, input: { name: string; phone?: string; email?: string }) => {
  const booking = await prisma.$transaction(async (tx) => {
    const guest = await tx.bookingGuest.findUnique({ where: { id: guestId } });
    if (!guest || guest.bookingId !== bookingId) throw new ApiError(404, "Guest not found");
    await tx.bookingGuest.update({ where: { id: guestId }, data: { name: input.name, phone: input.phone, email: input.email } });
    await writeBookingEvent(tx, { bookingId, type: "GUEST_UPDATED", actorType: actor.type, actorId: actor.id, metadata: { name: input.name } });
    return findBookingForLifecycle(tx, bookingId);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  return booking;
};

export const removeBookingGuest = async (bookingId: string, guestId: string, actor: Actor) => {
  const booking = await prisma.$transaction(async (tx) => {
    const guest = await tx.bookingGuest.findUnique({ where: { id: guestId } });
    if (!guest || guest.bookingId !== bookingId) throw new ApiError(404, "Guest not found");
    await tx.bookingGuest.delete({ where: { id: guestId } });
    await writeBookingEvent(tx, { bookingId, type: "GUEST_REMOVED", actorType: actor.type, actorId: actor.id, metadata: { name: guest.name } });
    return findBookingForLifecycle(tx, bookingId);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  return booking;
};

export const exchangeBookingRooms = async (bookingAId: string, bookingBId: string, actor: Actor) => {
  if (bookingAId === bookingBId) throw new ApiError(422, "Choose a different booking to exchange rooms with");
  const booking = await prisma.$transaction(async (tx) => {
    const [a, b] = await Promise.all([findBookingForLifecycle(tx, bookingAId), findBookingForLifecycle(tx, bookingBId)]);
    if (!a || !b) throw new ApiError(404, "Booking not found");
    if (a.stayProfileId !== b.stayProfileId) throw new ApiError(422, "Bookings must be at the same property to exchange rooms");
    if (!["CONFIRMED", "CHECKED_IN"].includes(a.bookingStatus) || !["CONFIRMED", "CHECKED_IN"].includes(b.bookingStatus)) {
      throw new ApiError(409, "Both bookings must be confirmed or checked in to exchange rooms");
    }
    if (a.roomId === b.roomId) throw new ApiError(422, "Bookings are already in the same room");

    const blockedForB = await tx.roomAvailability.findMany({
      where: {
        roomId: a.roomId,
        date: { in: eachBookedNight(b.checkInDate, b.checkOutDate) },
        status: { in: ["UNAVAILABLE", "BOOKED"] },
        OR: [{ bookingId: null }, { bookingId: { not: a.id } }],
      },
    });
    if (blockedForB.length) throw new ApiError(409, `${a.room.name} is not free for ${b.bookingRef}'s dates`);
    const blockedForA = await tx.roomAvailability.findMany({
      where: {
        roomId: b.roomId,
        date: { in: eachBookedNight(a.checkInDate, a.checkOutDate) },
        status: { in: ["UNAVAILABLE", "BOOKED"] },
        OR: [{ bookingId: null }, { bookingId: { not: b.id } }],
      },
    });
    if (blockedForA.length) throw new ApiError(409, `${b.room.name} is not free for ${a.bookingRef}'s dates`);

    await unlockBookingDates(tx, a.id);
    await unlockBookingDates(tx, b.id);
    await tx.booking.update({ where: { id: a.id }, data: { roomId: b.roomId, version: { increment: 1 } } });
    await tx.booking.update({ where: { id: b.id }, data: { roomId: a.roomId, version: { increment: 1 } } });
    await lockBookingDates(tx, a.id, b.roomId, a.checkInDate, a.checkOutDate);
    await lockBookingDates(tx, b.id, a.roomId, b.checkInDate, b.checkOutDate);
    await writeBookingEvent(tx, { bookingId: a.id, type: "ROOM_EXCHANGED", actorType: actor.type, actorId: actor.id, metadata: { withBookingId: b.id, newRoomId: b.roomId } });
    await writeBookingEvent(tx, { bookingId: b.id, type: "ROOM_EXCHANGED", actorType: actor.type, actorId: actor.id, metadata: { withBookingId: a.id, newRoomId: a.roomId } });
    return findBookingForLifecycle(tx, a.id);
  });
  if (!booking) throw new ApiError(404, "Booking not found");
  emitToProperty(booking.stayProfileId, socketEvents.bookingRoomChanged, booking);
  return booking;
};

export const expireBooking = async (bookingId: string) => {
  const booking = await prisma.$transaction(async (tx) => {
    const existing = await findBookingForLifecycle(tx, bookingId);
    if (!existing || existing.bookingStatus !== "PENDING") return null;
    const updatedCount = await tx.booking.updateMany({
      where: { id: existing.id, version: existing.version, bookingStatus: "PENDING" },
      data: { bookingStatus: "AUTO_CANCELLED", cancelledAt: new Date(), respondedAt: new Date(), version: { increment: 1 } },
    });
    if (updatedCount.count !== 1) return null;
    await writeBookingEvent(tx, {
      bookingId: existing.id,
      type: "AUTO_CANCELLED",
      fromStatus: "PENDING",
      toStatus: "AUTO_CANCELLED",
      actorType: "SYSTEM",
    });
    return findBookingForLifecycle(tx, existing.id);
  });
  if (!booking) return null;
  await deletePendingBookingMetadata(booking.id);
  await adapterSyncQueue.add("booking-expired", { bookingId: booking.id }, { attempts: 6, backoff: { type: "exponential", delay: 10000 } });
  await notificationQueue.add("booking-expired", { bookingId: booking.id }, { attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  emitToProperty(booking.stayProfileId, socketEvents.bookingExpired, booking);
  return booking;
};
