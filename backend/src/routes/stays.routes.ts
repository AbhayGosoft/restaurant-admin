import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";
import { imageUrlSchema } from "../utils/images.js";

const router = Router();

const stayInclude = {
  owner: { select: { id: true, name: true, email: true, phone: true } },
  amenities: { include: { amenity: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
  rooms: { include: { images: true, amenities: { include: { amenity: true } } } },
};

const phoneSchema = z.string().regex(/^(?:\d{7,10}|\+\d{8,14})$/, "Enter a valid phone number with up to 10 digits or international code");

const stayBaseSchema = z.object({
  ownerId: z.string().uuid().optional(),
  name: z.string().min(2),
  type: z.enum(["HOMESTAY", "DHARAMSHALA", "AIRBNB", "HOTEL", "RESORT", "ASHRAM", "OTHER"]),
  description: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  houseRules: z.string().optional(),
  addressLine: z.string().min(2),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  country: z.string(),
  pincode: z.string().min(3),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  contactNumber: phoneSchema,
  website: z.string().url().optional(),
  starRating: z.coerce.number().int().min(1).max(5).optional(),
  checkInTime: z.string(),
  checkOutTime: z.string(),
  taxesIncluded: z.boolean().optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  cancellationFeePercent: z.coerce.number().min(0).max(100).optional(),
  facilities: z.array(z.string()).optional(),
  nearByPlaces: z
    .array(
      z.object({
        name: z.string(),
        type: z.string().optional(),
        distance_km: z.coerce.number().optional(),
        latitude: z.coerce.number().optional(),
        longitude: z.coerce.number().optional(),
      }),
    )
    .optional(),
  amenityIds: z.array(z.string().uuid()),
  images: z
    .array(z.object({ imageUrl: imageUrlSchema, isCover: z.boolean().default(false), sortOrder: z.number().int().default(0) })),
});

const staySchema = stayBaseSchema.extend({
  country: z.string().default("India"),
  checkInTime: z.string().default("12:00"),
  checkOutTime: z.string().default("10:00"),
  amenityIds: z.array(z.string().uuid()).default([]),
  images: z.array(z.object({ imageUrl: imageUrlSchema, isCover: z.boolean().default(false), sortOrder: z.number().int().default(0) })).default([]),
});

const stayUpdateSchema = stayBaseSchema.partial();

const canAccessStay = async (userId: string, role: string, stayId: string) => {
  const stay = await prisma.stayProfile.findUnique({ where: { id: stayId } });
  if (!stay) {
    throw new ApiError(404, "Stay profile not found");
  }
  if (role !== "ADMIN" && stay.ownerId !== userId) {
    throw new ApiError(403, "You cannot access this stay");
  }
  return stay;
};

router.get(
  "/public",
  asyncHandler(async (req, res) => {
    const stays = await prisma.stayProfile.findMany({
      where: {
        status: "ACTIVE",
        city: req.query.city ? { contains: String(req.query.city) } : undefined,
        type: req.query.type ? (String(req.query.type).toUpperCase() as never) : undefined,
      },
      include: stayInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json(stays);
  }),
);

router.get(
  "/public/:id",
  asyncHandler(async (req, res) => {
    const stay = await prisma.stayProfile.findFirstOrThrow({
      where: { id: idParam(req), status: "ACTIVE" },
      include: stayInclude,
    });
    res.json(stay);
  }),
);

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where = req.user!.role === "ADMIN" ? {} : { ownerId: req.user!.id };
    const stays = await prisma.stayProfile.findMany({
      where,
      include: stayInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json(stays);
  }),
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(staySchema, req.body);
    const ownerId = req.user!.role === "ADMIN" ? (body.ownerId ?? req.user!.id) : req.user!.id;
    if (req.user!.role === "ADMIN" && !body.ownerId) {
      throw new ApiError(422, "ownerId is required when admin creates a stay");
    }

    const stay = await prisma.stayProfile.create({
      data: {
        ownerId,
        name: body.name,
        type: body.type,
        description: body.description,
        cancellationPolicy: body.cancellationPolicy,
        houseRules: body.houseRules,
        addressLine: body.addressLine,
        addressLine2: body.addressLine2,
        city: body.city,
        state: body.state,
        country: body.country,
        pincode: body.pincode,
        latitude: body.latitude,
        longitude: body.longitude,
        contactNumber: body.contactNumber,
        website: body.website,
        starRating: body.starRating,
        checkInTime: body.checkInTime,
        checkOutTime: body.checkOutTime,
        taxesIncluded: body.taxesIncluded,
        taxPercent: body.taxPercent,
        cancellationFeePercent: body.cancellationFeePercent,
        facilities: body.facilities,
        nearByPlaces: body.nearByPlaces,
        amenities: { create: body.amenityIds.map((amenityId) => ({ amenityId })) },
        images: { create: body.images },
      },
      include: stayInclude,
    });
    res.status(201).json(stay);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const stayId = idParam(req);
    await canAccessStay(req.user!.id, req.user!.role, stayId);
    const stay = await prisma.stayProfile.findUniqueOrThrow({
      where: { id: stayId },
      include: stayInclude,
    });
    res.json(stay);
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const stayId = idParam(req);
    await canAccessStay(req.user!.id, req.user!.role, stayId);
    const body = validateBody(stayUpdateSchema, req.body);

    const stay = await prisma.$transaction(async (tx) => {
      if (body.amenityIds) {
        await tx.stayAmenity.deleteMany({ where: { stayProfileId: stayId } });
      }
      if (body.images) {
        await tx.stayImage.deleteMany({ where: { stayProfileId: stayId } });
      }

      return tx.stayProfile.update({
        where: { id: stayId },
        data: {
          name: body.name,
          type: body.type,
          description: body.description,
          cancellationPolicy: body.cancellationPolicy,
          houseRules: body.houseRules,
          addressLine: body.addressLine,
          addressLine2: body.addressLine2,
          city: body.city,
          state: body.state,
          country: body.country,
          pincode: body.pincode,
          latitude: body.latitude,
          longitude: body.longitude,
          contactNumber: body.contactNumber,
          website: body.website,
          starRating: body.starRating,
          checkInTime: body.checkInTime,
          checkOutTime: body.checkOutTime,
          taxesIncluded: body.taxesIncluded,
          taxPercent: body.taxPercent,
          cancellationFeePercent: body.cancellationFeePercent,
          facilities: body.facilities,
          nearByPlaces: body.nearByPlaces,
          amenities: body.amenityIds ? { create: body.amenityIds.map((amenityId) => ({ amenityId })) } : undefined,
          images: body.images ? { create: body.images } : undefined,
        },
        include: stayInclude,
      });
    });

    res.json(stay);
  }),
);

router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const stayId = idParam(req);
    await canAccessStay(req.user!.id, req.user!.role, stayId);
    const body = validateBody(z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) }), req.body);
    const stay = await prisma.stayProfile.update({ where: { id: stayId }, data: { status: body.status } });
    res.json(stay);
  }),
);

export default router;
