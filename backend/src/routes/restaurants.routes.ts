import { Router } from "express";
import { z } from "zod";
import { requireCustomerAuth } from "../middleware/auth.js";
import { getRestaurantDetail, listRestaurants } from "../services/restaurantService.js";
import { getMenu } from "../services/menuService.js";
import { getAvailableSlots } from "../services/slotService.js";
import { createBooking } from "../services/bookingService.js";
import { TABLE_PREFERENCE_LABELS } from "../constants/bookingOptions.js";
import { asyncHandler, idParam, sendSuccess, validateBody, validateQuery } from "../utils/http.js";

const router = Router();

const coordinate = z.coerce.number().min(-180).max(180).optional();

const listQuerySchema = z.object({
  city: z.string().trim().optional(),
  category: z.string().trim().optional(),
  q: z.string().trim().optional(),
  latitude: coordinate,
  longitude: coordinate,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = validateQuery(listQuerySchema, req.query);
    const result = await listRestaurants(query);
    sendSuccess(res, { restaurants: result.restaurants, pagination: result.pagination });
  }),
);

const detailQuerySchema = z.object({ latitude: coordinate, longitude: coordinate });

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const query = validateQuery(detailQuerySchema, req.query);
    const userLocation = query.latitude !== undefined && query.longitude !== undefined ? { latitude: query.latitude, longitude: query.longitude } : undefined;
    const restaurant = await getRestaurantDetail(id, userLocation);
    sendSuccess(res, restaurant);
  }),
);

router.get(
  "/:id/menu",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const menu = await getMenu(id);
    sendSuccess(res, menu);
  }),
);

const slotsQuerySchema = z.object({
  date: z.string().min(1, "date is required"),
  people: z.coerce.number().int().min(1).default(1),
});

router.get(
  "/:id/slots",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const query = validateQuery(slotsQuerySchema, req.query);
    const slots = await getAvailableSlots(id, query.date, query.people);
    sendSuccess(res, slots);
  }),
);

const bookingSchema = z.object({
  date: z.string().min(1),
  time: z.string().min(1),
  people: z.coerce.number().int().min(1),
  tablePreference: z.enum(Object.values(TABLE_PREFERENCE_LABELS) as [string, ...string[]]),
  specialRequest: z.string().trim().max(500).optional(),
  fullName: z.string().trim().min(1),
  mobileNumber: z.string().trim().min(6),
  email: z.email().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  payment: z.object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
  }),
});

router.post(
  "/:id/bookings",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req);
    const body = validateBody(bookingSchema, req.body);
    const booking = await createBooking(req.customer!.id, restaurantId, {
      date: body.date,
      time: body.time,
      people: body.people,
      tablePreference: body.tablePreference,
      specialRequest: body.specialRequest,
      fullName: body.fullName,
      mobileNumber: body.mobileNumber,
      email: body.email,
      latitude: body.latitude,
      longitude: body.longitude,
      razorpayOrderId: body.payment.razorpay_order_id,
      razorpayPaymentId: body.payment.razorpay_payment_id,
    });
    sendSuccess(res, booking, "Booking confirmed", 201);
  }),
);

export default router;
