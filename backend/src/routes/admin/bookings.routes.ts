import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdminAuth } from "../../middleware/auth.js";
import { adminCancelBooking, getBookingForAdmin, listBookingsForAdmin } from "../../services/bookingService.js";
import { CANCELLATION_REASON_LABELS } from "../../constants/bookingOptions.js";
import { ApiError, asyncHandler, idParam, sendSuccess, validateBody, validateQuery } from "../../utils/http.js";
import { pagination } from "../../utils/query.js";

const router = Router();
router.use(requireAdminAuth);

const assertRestaurantAccess = async (adminId: string, role: string, restaurantId: string) => {
  if (role === "SUPERADMIN") return;
  const link = await prisma.adminRestaurant.findUnique({ where: { adminId_restaurantId: { adminId, restaurantId } } });
  if (!link) throw new ApiError(403, "You are not authorized to manage this restaurant");
};

const listQuerySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  status: z.enum(["upcoming", "past", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = validateQuery(listQuerySchema, req.query);
    if (query.restaurantId) await assertRestaurantAccess(req.admin!.id, req.admin!.role, query.restaurantId);

    let restaurantIds: string[] | undefined;
    if (!query.restaurantId && req.admin!.role !== "SUPERADMIN") {
      const links = await prisma.adminRestaurant.findMany({ where: { adminId: req.admin!.id }, select: { restaurantId: true } });
      restaurantIds = links.map((link) => link.restaurantId);
    }

    const result = await listBookingsForAdmin({
      restaurantId: query.restaurantId,
      restaurantIds,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    sendSuccess(res, { bookings: result.bookings, pagination: pagination(query.page, query.limit, result.total) });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const { booking, restaurantId } = await getBookingForAdmin(id);
    await assertRestaurantAccess(req.admin!.id, req.admin!.role, restaurantId);
    sendSuccess(res, booking);
  }),
);

const cancelSchema = z.object({ reason: z.enum(Object.values(CANCELLATION_REASON_LABELS) as [string, ...string[]]).default("Other") });

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const { restaurantId } = await getBookingForAdmin(id);
    await assertRestaurantAccess(req.admin!.id, req.admin!.role, restaurantId);
    const body = validateBody(cancelSchema, req.body);
    const result = await adminCancelBooking(id, body.reason);
    sendSuccess(res, result, "Booking cancelled");
  }),
);

export default router;
