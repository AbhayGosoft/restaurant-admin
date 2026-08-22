import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { advanceSetupStep } from "../services/setupService.js";
import { assertPropertyAccess } from "../services/propertyAccessService.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";
import { imageUrlSchema } from "../utils/images.js";
import { parseDateOnly } from "../utils/dates.js";
import { listQuerySchema } from "../utils/query.js";

const router = Router();

const roomInclude = {
  stayProfile: { select: { id: true, name: true, ownerId: true } },
  enterpriseRoomType: { select: { id: true, name: true, slug: true, pricePerNight: true, tax: { select: { id: true, name: true, percentage: true, type: true } } } },
  amenities: { include: { amenity: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
};

const roomBaseSchema = z.object({
  stayProfileId: z.string().uuid(),
  roomTypeId: z.string().uuid().optional(),
  name: z.string().min(1),
  roomType: z.enum(["SINGLE", "DOUBLE", "DORM", "SUITE", "FAMILY", "HALL", "OTHER"]).default("OTHER"),
  roomNumber: z.string().min(1).optional(),
  title: z.string().optional(),
  floor: z.string().optional(),
  physicalStatus: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"]).default("AVAILABLE"),
  capacityAdults: z.coerce.number().int().min(1).default(1),
  capacityChildren: z.coerce.number().int().min(0).default(0),
  basePrice: z.coerce.number().positive().optional(),
  extraBedPrice: z.coerce.number().nonnegative().optional(),
  gstType: z.enum(["NONE", "GST_5", "GST_12", "GST_18"]).default("NONE"),
  description: z.string().optional(),
  isClean: z.boolean().default(true),
  isBookable: z.boolean().default(true),
  showOnWebsite: z.boolean().default(true),
  amenityIds: z.array(z.string().uuid()).default([]),
  images: z.array(z.object({ imageUrl: imageUrlSchema, sortOrder: z.number().int().default(0) })).default([]),
});

const roomSchema = roomBaseSchema.refine((body) => body.roomTypeId || body.basePrice, { message: "basePrice is required when roomTypeId is not provided", path: ["basePrice"] });
const roomUpdateSchema = roomBaseSchema.partial().omit({ stayProfileId: true });

const canManageStay = async (userId: string, role: string, stayProfileId: string) => {
  const stay = await prisma.stayProfile.findUnique({ where: { id: stayProfileId } });
  if (!stay) throw new ApiError(404, "Stay profile not found");
  if (role !== "ADMIN" && stay.ownerId !== userId) throw new ApiError(403, "You cannot manage this stay");
  return stay;
};

const canManageRoom = async (userId: string, role: string, roomId: string) => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { stayProfile: true },
  });
  if (!room) throw new ApiError(404, "Room not found");
  if (role !== "ADMIN" && room.stayProfile.ownerId !== userId) throw new ApiError(403, "You cannot manage this room");
  return room;
};

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    if (query.propertyId) await assertPropertyAccess(req.user!.id, req.user!.role, query.propertyId);

    const rooms = await prisma.room.findMany({
      where: {
        stayProfileId: query.propertyId,
        stayProfile: query.propertyId ? undefined : req.user!.role === "ADMIN" ? {} : { ownerId: req.user!.id },
      },
      include: roomInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json(rooms);
  }),
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(roomSchema, req.body);
    const stay = await canManageStay(req.user!.id, req.user!.role, body.stayProfileId);
    const existingRooms = await prisma.room.count({ where: { stayProfileId: body.stayProfileId } });
    const enterpriseRoomType = body.roomTypeId
      ? await prisma.roomType.findFirst({ where: { id: body.roomTypeId, propertyId: body.stayProfileId, deletedAt: null } })
      : null;
    if (body.roomTypeId && !enterpriseRoomType) {
      throw new ApiError(422, "Room type does not belong to this property");
    }

    const room = await prisma.room.create({
      data: {
        stayProfileId: body.stayProfileId,
        roomTypeId: body.roomTypeId,
        name: body.name,
        roomType: body.roomType,
        roomNumber: body.roomNumber,
        title: body.title ?? body.name,
        floor: body.floor,
        physicalStatus: body.physicalStatus,
        capacityAdults: body.capacityAdults,
        capacityChildren: body.capacityChildren,
        basePrice: body.basePrice ?? enterpriseRoomType!.pricePerNight,
        extraBedPrice: body.extraBedPrice,
        gstType: body.gstType,
        description: body.description ?? enterpriseRoomType?.description,
        isClean: body.isClean,
        isBookable: body.isBookable,
        showOnWebsite: body.showOnWebsite,
        isDefault: existingRooms === 0,
        amenities: { create: body.amenityIds.map((amenityId) => ({ amenityId })) },
        images: { create: body.images },
      },
      include: roomInclude,
    });
    if (req.user!.role === "OWNER" && stay.ownerId === req.user!.id) {
      await advanceSetupStep(req.user!.id, "ROOM");
    }
    res.status(201).json(room);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const roomId = idParam(req);
    await canManageRoom(req.user!.id, req.user!.role, roomId);
    const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId }, include: roomInclude });
    res.json(room);
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const room = await canManageRoom(req.user!.id, req.user!.role, idParam(req));
    const body = validateBody(roomUpdateSchema, req.body);
    const enterpriseRoomType = body.roomTypeId
      ? await prisma.roomType.findFirst({ where: { id: body.roomTypeId, propertyId: room.stayProfileId, deletedAt: null } })
      : null;
    if (body.roomTypeId && !enterpriseRoomType) {
      throw new ApiError(422, "Room type does not belong to this property");
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.amenityIds) await tx.roomAmenity.deleteMany({ where: { roomId: room.id } });
      if (body.images) await tx.roomImage.deleteMany({ where: { roomId: room.id } });

      return tx.room.update({
        where: { id: room.id },
        data: {
          name: body.name,
          roomTypeId: body.roomTypeId,
          roomType: body.roomType,
          roomNumber: body.roomNumber,
          title: body.title,
          floor: body.floor,
          physicalStatus: body.physicalStatus,
          capacityAdults: body.capacityAdults,
          capacityChildren: body.capacityChildren,
          basePrice: body.basePrice,
          extraBedPrice: body.extraBedPrice,
          gstType: body.gstType,
          description: body.description,
          isClean: body.isClean,
          isBookable: body.isBookable,
          showOnWebsite: body.showOnWebsite,
          amenities: body.amenityIds ? { create: body.amenityIds.map((amenityId) => ({ amenityId })) } : undefined,
          images: body.images ? { create: body.images } : undefined,
        },
        include: roomInclude,
      });
    });
    res.json(updated);
  }),
);

router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const roomId = idParam(req);
    await canManageRoom(req.user!.id, req.user!.role, roomId);
    const body = validateBody(z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) }), req.body);
    const room = await prisma.room.update({ where: { id: roomId }, data: { status: body.status } });
    res.json(room);
  }),
);

router.get(
  "/:id/availability",
  asyncHandler(async (req, res) => {
    const roomId = idParam(req);
    await canManageRoom(req.user!.id, req.user!.role, roomId);
    const from = req.query.from ? parseDateOnly(String(req.query.from)) : undefined;
    const to = req.query.to ? parseDateOnly(String(req.query.to)) : undefined;
    const availability = await prisma.roomAvailability.findMany({
      where: {
        roomId,
        date: from || to ? { gte: from, lte: to } : undefined,
      },
      orderBy: { date: "asc" },
    });
    res.json(availability);
  }),
);

router.patch(
  "/:id/availability",
  asyncHandler(async (req, res) => {
    const roomId = idParam(req);
    await canManageRoom(req.user!.id, req.user!.role, roomId);
    const body = validateBody(
      z.object({
        dates: z.array(
          z.object({
            date: z.string(),
            status: z.enum(["AVAILABLE", "UNAVAILABLE", "BOOKED"]),
            priceOverride: z.coerce.number().positive().optional(),
          }),
        ),
      }),
      req.body,
    );

    await prisma.$transaction(
      body.dates.map((entry) =>
        prisma.roomAvailability.upsert({
          where: { roomId_date: { roomId, date: parseDateOnly(entry.date) } },
          create: {
            roomId,
            date: parseDateOnly(entry.date),
            status: entry.status,
            priceOverride: entry.priceOverride,
          },
          update: {
            status: entry.status,
            priceOverride: entry.priceOverride,
            bookingId: entry.status === "BOOKED" ? undefined : null,
          },
        }),
      ),
    );

    res.json({ message: "Availability updated" });
  }),
);

export default router;
