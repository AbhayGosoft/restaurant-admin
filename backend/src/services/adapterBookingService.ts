import { z } from "zod";
import type { PaymentMode } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { calculateRate } from "./ratePlanService.js";
import { dateRangeNights, parseDateOnly } from "../utils/dates.js";
import { ApiError } from "../utils/http.js";
import { assertRoomBelongsToStay } from "./bookingService.js";
import { createPendingBooking } from "./bookingLifecycleService.js";

const adapterServiceLineSchema = z.object({
  external_service_id: z.string().optional(),
  name: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  unit_price: z.coerce.number().optional(),
});

const phoneSchema = z.string().regex(/^(?:\d{7,10}|\+\d{8,14})$/, "Enter a valid phone number with up to 10 digits or international code");

export const adapterBookingSchema = z
  .object({
    // Canonical (v1 + v2) identifiers
    external_property_id: z.string().uuid().optional(),
    property_name: z.string().optional(),
    external_room_type_id: z.string().uuid().optional(),
    room_type_name: z.string().optional(),
    external_rate_plan_id: z.string().uuid().optional().or(z.literal("")),
    rate_plan_name: z.string().optional(),
    check_in: z.string().optional(),
    check_out: z.string().optional(),
    // Occupancy — v2 only, v1 has no concept of this
    adults: z.coerce.number().int().min(0).optional(),
    children: z.coerce.number().int().min(0).optional(),
    rooms: z.coerce.number().int().min(1).default(1),
    // Guest
    guest_name: z.string().min(2).optional(),
    guest_phone: phoneSchema.optional(),
    guest_email: z.email().optional().or(z.literal("")),
    guest_father_name: z.string().optional(),
    guest_date_of_birth: z.string().optional(),
    guest_gender: z.enum(["male", "female", "other"]).optional().or(z.literal("")),
    guest_address: z.string().optional(),
    guest_country: z.string().default("India"),
    guest_state: z.string().optional(),
    guest_city: z.string().optional(),
    guest_pincode: z.string().optional(),
    guest_id_proof_type: z.string().optional(),
    guest_id_proof_number: z.string().optional(),
    guest_nationality: z.string().default("Indian"),
    // Extra services booked alongside the room — v2 only
    services: z.array(adapterServiceLineSchema).optional(),
    // Payment — GoAdapter only calls create_booking after payment is already captured
    payment_status: z.string().default("paid"),
    payment_id: z.string().optional(),
    payment_gateway: z.string().optional(),
    payment_gateway_reference: z.string().optional(),
    payment_method: z.string().optional(),
    paid_at: z.string().optional(),
    amount_paid: z.coerce.number().optional(),
    // Discounts — reference only, never authoritative for what this PMS charges
    coupon_code: z.string().optional(),
    coupon_discount_amount: z.coerce.number().optional(),
    referral_discount_amount: z.coerce.number().optional(),
    discount_amount: z.coerce.number().optional(),
    final_amount: z.coerce.number().optional(),
    // GoAdapter's own references, for cross-referencing back if ever needed
    app_booking_id: z.string().optional(),
    app_booking_number: z.string().optional(),
    source: z.string().default("darshan_app"),
    remarks: z.string().optional(),
    // Legacy manual/internal fields (admin-created bookings, non-adapter)
    stayProfileId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
    guestName: z.string().min(2).optional(),
    guestPhone: phoneSchema.optional(),
    guestEmail: z.email().optional(),
    checkInDate: z.string().optional(),
    checkOutDate: z.string().optional(),
    noOfGuests: z.coerce.number().int().min(1).default(1),
    totalAmount: z.coerce.number().positive().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.external_room_type_id && data.check_in && data.check_out && data.guest_name && data.guest_phone) ||
      (data.stayProfileId && data.roomId && data.checkInDate && data.checkOutDate && data.guestName && data.guestPhone),
    { message: "Canonical booking fields or legacy booking fields are required" },
  );

export type AdapterBookingInput = z.infer<typeof adapterBookingSchema>;

const paymentModeFromMethod = (method?: string): PaymentMode => {
  const normalized = (method ?? "").toLowerCase();
  if (normalized.includes("upi")) return "UPI";
  if (normalized.includes("card")) return "CARD";
  if (normalized.includes("cash")) return "CASH";
  if (normalized.includes("bank") || normalized.includes("transfer") || normalized.includes("neft") || normalized.includes("rtgs")) return "BANK_TRANSFER";
  return "OTHER";
};

export const createPendingAdapterBooking = async (body: AdapterBookingInput) => {
  const isCanonical = Boolean(body.external_room_type_id);
  const checkInDate = parseDateOnly(isCanonical ? body.check_in! : body.checkInDate!);
  const checkOutDate = parseDateOnly(isCanonical ? body.check_out! : body.checkOutDate!);
  const nights = dateRangeNights(checkInDate, checkOutDate);

  if (isCanonical && body.rooms > 1) {
    throw new ApiError(422, "This property allots a single room per booking — split multi-room requests into separate bookings");
  }

  const room = isCanonical
    ? await prisma.room.findFirst({
        where: {
          roomTypeId: body.external_room_type_id,
          stayProfileId: body.external_property_id,
          status: "ACTIVE",
          isBookable: true,
          stayProfile: { status: "ACTIVE" },
        },
        include: { stayProfile: true, enterpriseRoomType: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      })
    : await assertRoomBelongsToStay(body.stayProfileId!, body.roomId!);
  if (!room) {
    throw new ApiError(404, "No active room is available for this room type");
  }

  const ratePlan = body.external_rate_plan_id
    ? await prisma.ratePlan.findFirst({
        where: { id: body.external_rate_plan_id, propertyId: room.stayProfileId, isActive: true, deletedAt: null },
        select: { amountType: true, amountValue: true },
      })
    : null;
  const nightlyPrice = ratePlan
    ? calculateRate(Number(room.basePrice), ratePlan.amountType, Number(ratePlan.amountValue))
    : Number(room.basePrice);

  // This PMS is always the source of truth for price — match requested extra services
  // against our own catalog and charge our own current price, never GoAdapter's unit_price.
  const requestedServices = isCanonical ? (body.services ?? []) : [];
  const requestedServiceIds = requestedServices.map((line) => line.external_service_id).filter((id): id is string => Boolean(id));
  const matchedServices = requestedServiceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: requestedServiceIds }, propertyId: room.stayProfileId },
        select: { id: true, title: true, price: true },
      })
    : [];
  const serviceLines = requestedServices
    .map((line) => {
      const matched = matchedServices.find((service) => service.id === line.external_service_id);
      return matched ? { serviceId: matched.id, title: matched.title, price: matched.price, quantity: line.quantity } : null;
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));
  const servicesTotal = serviceLines.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);

  // services is only ever populated on the canonical path, so this is a no-op for legacy bookings
  const price = body.totalAmount ?? nightlyPrice * nights + servicesTotal;
  const noOfGuests = isCanonical ? Math.max(1, (body.adults ?? 1) + (body.children ?? 0)) : body.noOfGuests;

  const notes =
    body.notes ??
    (isCanonical
      ? JSON.stringify({
          property_name: body.property_name ?? "",
          room_type_name: body.room_type_name ?? "",
          rate_plan_name: body.rate_plan_name ?? "",
          guest_father_name: body.guest_father_name ?? "",
          guest_date_of_birth: body.guest_date_of_birth ?? "",
          guest_gender: body.guest_gender ?? "",
          guest_address: body.guest_address ?? "",
          guest_country: body.guest_country ?? "India",
          guest_state: body.guest_state ?? "",
          guest_city: body.guest_city ?? "",
          guest_pincode: body.guest_pincode ?? "",
          guest_id_proof_type: body.guest_id_proof_type ?? "",
          guest_id_proof_number: body.guest_id_proof_number ?? "",
          guest_nationality: body.guest_nationality ?? "Indian",
          coupon_code: body.coupon_code ?? "",
          coupon_discount_amount: body.coupon_discount_amount ?? 0,
          referral_discount_amount: body.referral_discount_amount ?? 0,
          discount_amount: body.discount_amount ?? 0,
          app_amount_paid: body.amount_paid ?? 0,
          app_final_amount: body.final_amount ?? 0,
          app_booking_id: body.app_booking_id ?? "",
          app_booking_number: body.app_booking_number ?? "",
          remarks: body.remarks ?? "",
        })
      : undefined);

  const booking = await createPendingBooking({
    stayProfileId: room.stayProfileId,
    roomId: room.id,
    guestName: isCanonical ? body.guest_name! : body.guestName!,
    guestPhone: isCanonical ? body.guest_phone! : body.guestPhone!,
    guestEmail: isCanonical ? body.guest_email || undefined : body.guestEmail,
    checkInDate,
    checkOutDate,
    noOfGuests,
    totalAmount: price,
    paymentStatus: body.payment_status?.toLowerCase() === "paid" ? "PAID" : "UNPAID",
    source: "SAAS_ADAPTER",
    notes,
  });

  if (serviceLines.length) {
    await prisma.bookingService.createMany({
      data: serviceLines.map((line) => ({
        bookingId: booking.id,
        serviceId: line.serviceId,
        title: line.title,
        price: line.price,
        quantity: line.quantity,
      })),
    });
  }

  if (isCanonical && body.payment_status?.toLowerCase() === "paid" && (body.amount_paid || body.final_amount)) {
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: body.amount_paid ?? body.final_amount ?? price,
        paymentMode: paymentModeFromMethod(body.payment_method),
        transactionRef: body.payment_gateway_reference ?? body.payment_id,
        paidAt: body.paid_at && !Number.isNaN(Date.parse(body.paid_at)) ? new Date(body.paid_at) : new Date(),
        status: "SUCCESS",
      },
    });
  }

  return booking;
};
