import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { advanceSetupStep } from "../services/setupService.js";
import { assertPropertyAccess } from "../services/propertyAccessService.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";
import { listQuerySchema, pagination, slugify } from "../utils/query.js";
import { imageUrlSchema } from "../utils/images.js";

const router = Router();

const roomTypeSelect = {
  id: true,
  propertyId: true,
  categoryId: true,
  name: true,
  slug: true,
  description: true,
  overview: true,
  keyFeatures: true,
  policies: true,
  pricePerNight: true,
  capacity: true,
  maxAdults: true,
  maxChildren: true,
  taxId: true,
   tax: {
    select: {
      id: true,
      name: true,
      percentage: true,
      type: true,
    },
  },
  smokingAllowed: true,
  sizeSqFt: true,
  bedType: true,
  acType: true,
  floor: true,
  view: true,
  attachedBathroom: true,
  featuredImage: true,
  galleryImages: true,
  isActive: true,
  category: { select: { id: true, name: true, slug: true } },
  amenities: { select: { amenity: { select: { id: true, name: true, icon: true } } } },
  _count: { select: { rooms: true, services: true, ratePlans: true } },
};

const roomTypeBaseSchema = z.object({
  propertyId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
  overview: z.string().optional(),
  keyFeatures: z.array(z.string()).default([]),
  policies: z.record(z.string(), z.unknown()).optional(),
  pricePerNight: z.coerce.number().positive(),
  capacity: z.coerce.number().int().min(1),
  maxAdults: z.coerce.number().int().min(1),
  maxChildren: z.coerce.number().int().min(0),
  taxId: z.string().uuid().nullable().optional(),
  smokingAllowed: z.boolean(),
  sizeSqFt: z.coerce.number().int().positive().optional(),
  bedType: z.string().optional(),
  acType: z.enum(["AC", "Non-AC"]).optional(),
  floor: z.string().optional(),
  view: z.string().optional(),
  attachedBathroom: z.boolean(),
  featuredImage: imageUrlSchema.optional(),
  galleryImages: z.array(imageUrlSchema),
  isActive: z.boolean(),
  amenityIds: z.array(z.string().uuid()),
});

const capacityMatchesOccupants = (data: { capacity?: number; maxAdults?: number; maxChildren?: number }) =>
  data.capacity === undefined || data.maxAdults === undefined || data.maxChildren === undefined
    || data.maxAdults + data.maxChildren === data.capacity;

const capacityRefinement = { message: "Capacity must equal max adults + max children", path: ["capacity"] };

const roomTypeSchema = roomTypeBaseSchema.extend({
  maxChildren: z.coerce.number().int().min(0).default(0),
  smokingAllowed: z.boolean().default(false),
  attachedBathroom: z.boolean().default(true),
  galleryImages: z.array(imageUrlSchema).default([]),
  isActive: z.boolean().default(true),
  amenityIds: z.array(z.string().uuid()).default([]),
}).refine(capacityMatchesOccupants, capacityRefinement);

const roomTypeUpdateSchema = roomTypeBaseSchema.partial().omit({ propertyId: true }).refine(capacityMatchesOccupants, capacityRefinement);

const assertCategoryForProperty = async (categoryId: string, propertyId: string) => {
  const category = await prisma.propertyCategory.findFirst({ where: { id: categoryId, propertyId, deletedAt: null } });
  if (!category) throw new ApiError(422, "Category does not belong to this property");
};

const assertTaxForProperty = async (taxId: string | null | undefined, propertyId: string) => {
  if (!taxId) return;
  const tax = await prisma.propertyTax.findFirst({ where: { id: taxId, propertyId, deletedAt: null, isActive: true } });
  if (!tax) throw new ApiError(422, "Tax does not belong to this property");
};

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.extend({ categoryId: z.string().uuid().optional() }).parse(req.query);
    if (query.propertyId) await assertPropertyAccess(req.user!.id, req.user!.role, query.propertyId);

    const where = {
      deletedAt: null,
      propertyId: query.propertyId,
      categoryId: query.categoryId,
      isActive: query.isActive,
      property: req.user!.role === "ADMIN" ? undefined : { ownerId: req.user!.id },
      OR: query.search ? [{ name: { contains: query.search } }, { description: { contains: query.search } }] : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.roomType.findMany({
        where,
        select: roomTypeSelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.roomType.count({ where }),
    ]);

    res.json({ data: items, pagination: pagination(query.page, query.limit, total) });
  }),
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(roomTypeSchema, req.body);
    const property = await assertPropertyAccess(req.user!.id, req.user!.role, body.propertyId);
    await assertCategoryForProperty(body.categoryId, body.propertyId);
    await assertTaxForProperty(body.taxId, body.propertyId);
    const { amenityIds, policies, keyFeatures, galleryImages, ...data } = body;

    const roomType = await prisma.roomType.create({
      data: {
        ...data,
        slug: body.slug ?? slugify(body.name),
        policies: policies as never,
        keyFeatures,
        galleryImages,
        amenities: { create: amenityIds.map((amenityId) => ({ amenityId })) },
      },
      select: roomTypeSelect,
    });

    if (req.user!.role === "OWNER" && property.ownerId === req.user!.id) {
      await advanceSetupStep(req.user!.id, "ROOM_TYPE");
    }

    res.status(201).json(roomType);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const roomType = await prisma.roomType.findFirst({
      where: { id: idParam(req), deletedAt: null, property: req.user!.role === "ADMIN" ? undefined : { ownerId: req.user!.id } },
      select: roomTypeSelect,
    });
    if (!roomType) throw new ApiError(404, "Room type not found");
    res.json(roomType);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.roomType.findUnique({ where: { id: idParam(req) } });
    if (!existing || existing.deletedAt) throw new ApiError(404, "Room type not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, existing.propertyId);
    const body = validateBody(roomTypeUpdateSchema, req.body);
    if (body.categoryId) await assertCategoryForProperty(body.categoryId, existing.propertyId);
    await assertTaxForProperty(body.taxId, existing.propertyId);
    const { amenityIds, policies, keyFeatures, galleryImages, ...data } = body;

    const roomType = await prisma.$transaction(async (tx) => {
      if (amenityIds) await tx.roomTypeAmenity.deleteMany({ where: { roomTypeId: existing.id } });
      return tx.roomType.update({
        where: { id: existing.id },
        data: {
          ...data,
          slug: body.slug ?? (body.name ? slugify(body.name) : undefined),
          policies: policies as never,
          keyFeatures,
          galleryImages,
          amenities: amenityIds ? { create: amenityIds.map((amenityId) => ({ amenityId })) } : undefined,
        },
        select: roomTypeSelect,
      });
    });

    res.json(roomType);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const roomType = await prisma.roomType.findUnique({
      where: { id: idParam(req) },
      select: { id: true, propertyId: true, _count: { select: { rooms: true } } },
    });
    if (!roomType) throw new ApiError(404, "Room type not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, roomType.propertyId);
    if (roomType._count.rooms > 0) throw new ApiError(409, "Room type has rooms and cannot be deleted");

    await prisma.roomType.update({ where: { id: roomType.id }, data: { deletedAt: new Date(), isActive: false } });
    res.status(204).send();
  }),
);

export default router;
