import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { advanceSetupStep } from "../services/setupService.js";
import { calculateRate } from "../services/ratePlanService.js";
import { assertPropertyAccess } from "../services/propertyAccessService.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";
import { parseDateOnly } from "../utils/dates.js";
import { listQuerySchema, pagination } from "../utils/query.js";

const router = Router();

const ratePlanSelect = {
  id: true,
  propertyId: true,
  name: true,
  description: true,
  amountType: true,
  amountValue: true,
  applicability: true,
  startDate: true,
  endDate: true,
  applicableDays: true,
  applicableMonths: true,
  applicableYears: true,
  isRefundable: true,
  mealPlan: true,
  freeCancellation: true,
  payAtHotel: true,
  advancePaymentPercent: true,
  cancellationPolicy: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { roomTypes: true, services: true } },
};

const ratePlanDetailSelect = {
  ...ratePlanSelect,
  roomTypes: { select: { roomType: { select: { id: true, name: true, slug: true } } } },
  services: { select: { service: { select: { id: true, title: true, price: true } } } },
};

const ratePlanBaseSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().optional(),
  amountType: z.enum(["FLAT", "PERCENTAGE"]),
  amountValue: z.coerce.number().nonnegative(),
  applicability: z.enum(["ALL", "SPECIFIC_DAYS", "DATE_RANGE", "SPECIFIC_MONTHS", "SPECIFIC_YEARS"]).default("ALL"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  applicableDays: z.array(z.number().int().min(0).max(6)).default([]),
  applicableMonths: z.array(z.number().int().min(1).max(12)).default([]),
  applicableYears: z.array(z.number().int().min(2000)).default([]),
  isRefundable: z.boolean().default(true),
  mealPlan: z.enum(["ROOM_ONLY", "BREAKFAST", "HALF_BOARD", "FULL_BOARD", "ALL_INCLUSIVE"]).default("ROOM_ONLY"),
  freeCancellation: z.boolean().default(false),
  payAtHotel: z.boolean().default(false),
  advancePaymentPercent: z.coerce.number().min(0).max(100).default(0),
  cancellationPolicy: z.string().optional(),
  isActive: z.boolean().default(true),
  roomTypeIds: z.array(z.string().uuid()).default([]),
  serviceIds: z.array(z.string().uuid()).default([]),
});

const ratePlanSchema = ratePlanBaseSchema
  .refine((data) => data.amountType !== "PERCENTAGE" || data.amountValue <= 100, {
    message: "Percentage rate plans cannot exceed 100",
    path: ["amountValue"],
  })
  .refine((data) => data.applicability !== "DATE_RANGE" || (data.startDate && data.endDate), {
    message: "startDate and endDate are required for DATE_RANGE",
    path: ["startDate"],
  });

const ratePlanUpdateSchema = ratePlanBaseSchema
  .partial()
  .omit({ propertyId: true })
  .refine((data) => data.amountType !== "PERCENTAGE" || data.amountValue === undefined || data.amountValue <= 100, {
    message: "Percentage rate plans cannot exceed 100",
    path: ["amountValue"],
  })
  .refine((data) => data.applicability !== "DATE_RANGE" || (data.startDate && data.endDate), {
    message: "startDate and endDate are required for DATE_RANGE",
    path: ["startDate"],
  });

const assertMappingsForProperty = async (propertyId: string, roomTypeIds: string[], serviceIds: string[]) => {
  const uniqueRoomTypeIds = [...new Set(roomTypeIds)];
  const uniqueServiceIds = [...new Set(serviceIds)];
  const [roomTypeCount, serviceCount] = await prisma.$transaction([
    prisma.roomType.count({ where: { id: { in: uniqueRoomTypeIds }, propertyId, deletedAt: null } }),
    prisma.service.count({ where: { id: { in: uniqueServiceIds }, propertyId, deletedAt: null } }),
  ]);

  if (roomTypeCount !== uniqueRoomTypeIds.length) throw new ApiError(422, "One or more room types do not belong to this property");
  if (serviceCount !== uniqueServiceIds.length) throw new ApiError(422, "One or more services do not belong to this property");
};

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    if (query.propertyId) await assertPropertyAccess(req.user!.id, req.user!.role, query.propertyId);

    const where = {
      deletedAt: null,
      propertyId: query.propertyId,
      isActive: query.isActive,
      property: req.user!.role === "ADMIN" ? undefined : { ownerId: req.user!.id },
      OR: query.search ? [{ name: { contains: query.search } }, { description: { contains: query.search } }] : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.ratePlan.findMany({
        where,
        select: ratePlanSelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.ratePlan.count({ where }),
    ]);

    res.json({ data: items, pagination: pagination(query.page, query.limit, total) });
  }),
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(ratePlanSchema, req.body);
    const property = await assertPropertyAccess(req.user!.id, req.user!.role, body.propertyId);
    await assertMappingsForProperty(body.propertyId, body.roomTypeIds, body.serviceIds);
    const { roomTypeIds, serviceIds, startDate, endDate, ...data } = body;

    const ratePlan = await prisma.ratePlan.create({
      data: {
        ...data,
        startDate: startDate ? parseDateOnly(startDate) : undefined,
        endDate: endDate ? parseDateOnly(endDate) : undefined,
        roomTypes: { create: roomTypeIds.map((roomTypeId) => ({ roomTypeId })) },
        services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
      },
      select: ratePlanSelect,
    });

    if (req.user!.role === "OWNER" && property.ownerId === req.user!.id) {
      await advanceSetupStep(req.user!.id, "RATE_PLAN");
    }

    res.status(201).json(ratePlan);
  }),
);

router.post(
  "/calculate",
  asyncHandler(async (req, res) => {
    const body = validateBody(
      z.object({
        basePrice: z.coerce.number().positive(),
        amountType: z.enum(["FLAT", "PERCENTAGE"]),
        amountValue: z.coerce.number().nonnegative(),
      }),
      req.body,
    );
    res.json({ finalRate: calculateRate(body.basePrice, body.amountType, body.amountValue) });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const ratePlan = await prisma.ratePlan.findFirst({
      where: { id: idParam(req), deletedAt: null, property: req.user!.role === "ADMIN" ? undefined : { ownerId: req.user!.id } },
      select: ratePlanDetailSelect,
    });
    if (!ratePlan) throw new ApiError(404, "Rate plan not found");
    res.json(ratePlan);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.ratePlan.findUnique({ where: { id: idParam(req) } });
    if (!existing || existing.deletedAt) throw new ApiError(404, "Rate plan not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, existing.propertyId);
    const body = validateBody(ratePlanUpdateSchema, req.body);
    await assertMappingsForProperty(existing.propertyId, body.roomTypeIds ?? [], body.serviceIds ?? []);
    const { roomTypeIds, serviceIds, startDate, endDate, ...data } = body;

    const ratePlan = await prisma.$transaction(async (tx) => {
      if (roomTypeIds) await tx.ratePlanRoomType.deleteMany({ where: { ratePlanId: existing.id } });
      if (serviceIds) await tx.ratePlanService.deleteMany({ where: { ratePlanId: existing.id } });
      return tx.ratePlan.update({
        where: { id: existing.id },
        data: {
          ...data,
          startDate: startDate ? parseDateOnly(startDate) : undefined,
          endDate: endDate ? parseDateOnly(endDate) : undefined,
          roomTypes: roomTypeIds ? { create: roomTypeIds.map((roomTypeId) => ({ roomTypeId })) } : undefined,
          services: serviceIds ? { create: serviceIds.map((serviceId) => ({ serviceId })) } : undefined,
        },
        select: ratePlanDetailSelect,
      });
    });

    res.json(ratePlan);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const ratePlan = await prisma.ratePlan.findUnique({ where: { id: idParam(req) } });
    if (!ratePlan) throw new ApiError(404, "Rate plan not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, ratePlan.propertyId);
    await prisma.ratePlan.update({ where: { id: ratePlan.id }, data: { deletedAt: new Date(), isActive: false } });
    res.status(204).send();
  }),
);

export default router;
