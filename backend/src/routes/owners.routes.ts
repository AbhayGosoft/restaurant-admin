import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";

const router = Router();

const phoneSchema = z.string().regex(/^(?:\d{7,10}|\+\d{8,14})$/, "Enter a valid phone number with up to 10 digits or international code");

const createOwnerSchema = z.object({
  name: z.string().min(2),
  email: z.email().transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  businessName: z.string().optional(),
  password: z.string().min(8),
});

const updateOwnerSchema = createOwnerSchema
  .partial()
  .extend({
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    password: z.string().min(8).optional(),
  });

const ownerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  businessName: true,
  avatarUrl: true,
  mustResetPassword: true,
  setupCompleted: true,
  currentStep: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { stayProfiles: true } },
};

router.use(requireAuth, requireRole("ADMIN"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const owners = await prisma.user.findMany({
      where: { role: "OWNER" },
      orderBy: { createdAt: "desc" },
      select: ownerSelect,
    });
    res.json(owners);
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = validateBody(createOwnerSchema, req.body);
    const exists = await prisma.user.findFirst({
      where: { OR: [{ email: body.email }, ...(body.phone ? [{ phone: body.phone }] : [])] },
    });
    if (exists) {
      throw new ApiError(409, "Owner email or phone already exists");
    }

    const owner = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        businessName: body.businessName,
        role: "OWNER",
        passwordHash: await bcrypt.hash(body.password, 12),
        mustResetPassword: true,
      },
      select: ownerSelect,
    });

    res.status(201).json(owner);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const owner = await prisma.user.findFirstOrThrow({
      where: { id: idParam(req), role: "OWNER" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        businessName: true,
        stayProfiles: {
          include: {
            rooms: true,
            images: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });
    res.json(owner);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const ownerId = idParam(req);
    const body = validateBody(updateOwnerSchema, req.body);
    const existing = await prisma.user.findFirst({ where: { id: ownerId, role: "OWNER" } });
    if (!existing) throw new ApiError(404, "Owner not found");

    if (body.email || body.phone) {
      const duplicate = await prisma.user.findFirst({
        where: {
          id: { not: ownerId },
          OR: [{ email: body.email ?? "" }, ...(body.phone ? [{ phone: body.phone }] : [])],
        },
      });
      if (duplicate) throw new ApiError(409, "Owner email or phone already exists");
    }

    const owner = await prisma.user.update({
      where: { id: ownerId },
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        businessName: body.businessName,
        status: body.status,
        ...(body.password
          ? {
              passwordHash: await bcrypt.hash(body.password, 12),
              mustResetPassword: true,
            }
          : {}),
      },
      select: ownerSelect,
    });

    res.json(owner);
  }),
);

router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const body = validateBody(z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) }), req.body);
    const owner = await prisma.user.update({
      where: { id: idParam(req) },
      data: { status: body.status },
      select: { id: true, status: true },
    });
    res.json(owner);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const owner = await prisma.user.findFirst({
      where: { id: idParam(req), role: "OWNER" },
      select: { id: true, _count: { select: { stayProfiles: true } } },
    });
    if (!owner) throw new ApiError(404, "Owner not found");
    if (owner._count.stayProfiles > 0) {
      throw new ApiError(409, "Owner has properties and cannot be deleted. Set status to inactive instead.");
    }
    await prisma.user.delete({ where: { id: owner.id } });
    res.status(204).send();
  }),
);

export default router;
