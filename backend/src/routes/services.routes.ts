import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { advanceSetupStep } from "../services/setupService.js";
import { assertPropertyAccess } from "../services/propertyAccessService.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";
import { imageUrlSchema } from "../utils/images.js";
import { parseDateOnly } from "../utils/dates.js";
import { booleanQueryParam, listQuerySchema, pagination } from "../utils/query.js";

const router = Router();

const serviceSelect = {
  id: true,
  propertyId: true,
  title: true,
  description: true,
  price: true,
  priceType: true,
  gstType: true,
  isMandatory: true,
  quantityAllowed: true,
  availableDays: true,
  validFrom: true,
  validTo: true,
  images: true,
  isAvailable: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { roomTypes: true, ratePlans: true, availability: true } },
};

const serviceSchema = z.object({
  propertyId: z.string().uuid(),
  title: z.string().min(2),
  description: z.string().optional(),
  price: z.coerce.number().nonnegative().default(0),
  priceType: z.enum(["PER_STAY", "PER_GUEST", "PER_ROOM"]).default("PER_STAY"),
  gstType: z.enum(["NONE", "GST_5", "GST_12", "GST_18"]).default("NONE"),
  isMandatory: z.boolean().default(false),
  quantityAllowed: z.coerce.number().int().positive().optional(),
  availableDays: z.array(z.string()).default([]),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  images: z.array(imageUrlSchema).default([]),
  isAvailable: z.boolean().default(true),
  roomTypeIds: z.array(z.string().uuid()).default([]),
});

const assertRoomTypesForProperty = async (roomTypeIds: string[], propertyId: string) => {
  if (roomTypeIds.length === 0) return;
  const count = await prisma.roomType.count({ where: { id: { in: roomTypeIds }, propertyId, deletedAt: null } });
  if (count !== new Set(roomTypeIds).size) throw new ApiError(422, "One or more room types do not belong to this property");
};

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.extend({ isAvailable: booleanQueryParam.optional() }).parse(req.query);
    if (query.propertyId) await assertPropertyAccess(req.user!.id, req.user!.role, query.propertyId);

    const where = {
      deletedAt: null,
      propertyId: query.propertyId,
      isAvailable: query.isAvailable,
      property: req.user!.role === "ADMIN" ? undefined : { ownerId: req.user!.id },
      OR: query.search ? [{ title: { contains: query.search } }, { description: { contains: query.search } }] : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.service.findMany({
        where,
        select: serviceSelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.service.count({ where }),
    ]);

    res.json({ data: items, pagination: pagination(query.page, query.limit, total) });
  }),
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(serviceSchema, req.body);
    const property = await assertPropertyAccess(req.user!.id, req.user!.role, body.propertyId);
    await assertRoomTypesForProperty(body.roomTypeIds, body.propertyId);
    const { roomTypeIds, validFrom, validTo, ...data } = body;

    const service = await prisma.service.create({
      data: {
        ...data,
        validFrom: validFrom ? parseDateOnly(validFrom) : undefined,
        validTo: validTo ? parseDateOnly(validTo) : undefined,
        roomTypes: { create: roomTypeIds.map((roomTypeId) => ({ roomTypeId })) },
      },
      select: serviceSelect,
    });

    if (req.user!.role === "OWNER" && property.ownerId === req.user!.id) {
      await advanceSetupStep(req.user!.id, "SERVICE");
    }

    res.status(201).json(service);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const service = await prisma.service.findFirst({
      where: { id: idParam(req), deletedAt: null, property: req.user!.role === "ADMIN" ? undefined : { ownerId: req.user!.id } },
      select: {
        ...serviceSelect,
        roomTypes: { select: { roomType: { select: { id: true, name: true, slug: true } } } },
        availability: { take: 30, orderBy: { date: "asc" } },
      },
    });
    if (!service) throw new ApiError(404, "Service not found");
    res.json(service);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.service.findUnique({ where: { id: idParam(req) } });
    if (!existing || existing.deletedAt) throw new ApiError(404, "Service not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, existing.propertyId);
    const body = validateBody(serviceSchema.partial().omit({ propertyId: true }), req.body);
    if (body.roomTypeIds) await assertRoomTypesForProperty(body.roomTypeIds, existing.propertyId);
    const { roomTypeIds, validFrom, validTo, ...data } = body;

    const service = await prisma.$transaction(async (tx) => {
      if (roomTypeIds) await tx.roomTypeService.deleteMany({ where: { serviceId: existing.id } });
      return tx.service.update({
        where: { id: existing.id },
        data: {
          ...data,
          validFrom: validFrom ? parseDateOnly(validFrom) : undefined,
          validTo: validTo ? parseDateOnly(validTo) : undefined,
          roomTypes: roomTypeIds ? { create: roomTypeIds.map((roomTypeId) => ({ roomTypeId })) } : undefined,
        },
        select: serviceSelect,
      });
    });

    res.json(service);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const service = await prisma.service.findUnique({
      where: { id: idParam(req) },
      select: { id: true, propertyId: true, _count: { select: { ratePlans: true } } },
    });
    if (!service) throw new ApiError(404, "Service not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, service.propertyId);
    if (service._count.ratePlans > 0) throw new ApiError(409, "Service is mapped to rate plans and cannot be deleted");

    await prisma.service.update({ where: { id: service.id }, data: { deletedAt: new Date(), isAvailable: false } });
    res.status(204).send();
  }),
);

router.put(
  "/:id/availability",
  asyncHandler(async (req, res) => {
    const service = await prisma.service.findUnique({ where: { id: idParam(req) } });
    if (!service || service.deletedAt) throw new ApiError(404, "Service not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, service.propertyId);
    const body = validateBody(
      z.object({
        dates: z.array(z.object({ date: z.string(), isAvailable: z.boolean() })),
      }),
      req.body,
    );

    await prisma.$transaction(
      body.dates.map((entry) =>
        prisma.serviceAvailability.upsert({
          where: { serviceId_date: { serviceId: service.id, date: parseDateOnly(entry.date) } },
          create: { serviceId: service.id, date: parseDateOnly(entry.date), isAvailable: entry.isAvailable },
          update: { isAvailable: entry.isAvailable },
        }),
      ),
    );

    res.json({ message: "Service availability updated" });
  }),
);

export default router;
