import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdminAuth, requireRestaurantAccess } from "../../middleware/auth.js";
import { ApiError, asyncHandler, idParam, sendSuccess, validateBody } from "../../utils/http.js";
import { isValidTime12, to12Hour, to24Hour } from "../../utils/slotTime.js";

// Mounted at /api/admin/restaurants/:restaurantId/slots
const router = Router({ mergeParams: true });
router.use(requireAdminAuth, requireRestaurantAccess("restaurantId"));

const toSlot = (slot: any) => ({
  id: slot.id,
  meal: slot.meal,
  time: to12Hour(slot.time),
  sortOrder: slot.sortOrder,
  isActive: slot.isActive,
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req, "restaurantId");
    const slots = await prisma.slotConfiguration.findMany({
      where: { restaurantId },
      orderBy: [{ meal: "asc" }, { sortOrder: "asc" }],
    });
    sendSuccess(res, slots.map(toSlot));
  }),
);

const slotSchema = z.object({
  meal: z.enum(["LUNCH", "DINNER"]),
  time: z.string().refine(isValidTime12, { message: 'time must look like "12:00 PM"' }),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req, "restaurantId");
    const body = validateBody(slotSchema, req.body);
    const slot = await prisma.slotConfiguration.create({
      data: { restaurantId, meal: body.meal, time: to24Hour(body.time), sortOrder: body.sortOrder, isActive: body.isActive },
    });
    sendSuccess(res, toSlot(slot), "Slot created", 201);
  }),
);

const assertSlotInRestaurant = async (restaurantId: string, slotId: string) => {
  const slot = await prisma.slotConfiguration.findFirst({ where: { id: slotId, restaurantId } });
  if (!slot) throw new ApiError(404, "Slot not found");
  return slot;
};

router.patch(
  "/:slotId",
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req, "restaurantId");
    const slotId = idParam(req, "slotId");
    await assertSlotInRestaurant(restaurantId, slotId);
    const body = validateBody(slotSchema.partial(), req.body);
    const slot = await prisma.slotConfiguration.update({
      where: { id: slotId },
      data: { ...body, time: body.time ? to24Hour(body.time) : undefined },
    });
    sendSuccess(res, toSlot(slot), "Slot updated");
  }),
);

router.delete(
  "/:slotId",
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req, "restaurantId");
    const slotId = idParam(req, "slotId");
    await assertSlotInRestaurant(restaurantId, slotId);
    await prisma.slotConfiguration.update({ where: { id: slotId }, data: { isActive: false } });
    sendSuccess(res, {}, "Slot deactivated");
  }),
);

export default router;
