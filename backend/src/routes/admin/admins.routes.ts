import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdminAuth, requireSuperAdmin } from "../../middleware/auth.js";
import { ApiError, asyncHandler, idParam, sendSuccess, validateBody } from "../../utils/http.js";

const router = Router();
router.use(requireAdminAuth, requireSuperAdmin);

const adminSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  restaurants: { select: { restaurant: { select: { id: true, name: true } } } },
} as const;

// OpenAPI docs: src/docs/admin/admins.docs.ts
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const admins = await prisma.adminUser.findMany({ select: adminSelect, orderBy: { createdAt: "desc" } });
    sendSuccess(res, admins);
  }),
);

const createSchema = z.object({
  name: z.string().trim().min(1),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "SUPERADMIN"]).default("ADMIN"),
  restaurantIds: z.array(z.string().uuid()).default([]),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = validateBody(createSchema, req.body);
    const existing = await prisma.adminUser.findUnique({ where: { email: body.email } });
    if (existing) throw new ApiError(409, "An admin with this email already exists");

    const admin = await prisma.adminUser.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 12),
        role: body.role,
        restaurants: { create: body.restaurantIds.map((restaurantId) => ({ restaurantId })) },
      },
      select: adminSelect,
    });
    sendSuccess(res, admin, "Admin created", 201);
  }),
);

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(["ADMIN", "SUPERADMIN"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  password: z.string().min(8).optional(),
  restaurantIds: z.array(z.string().uuid()).optional(),
});

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const body = validateBody(updateSchema, req.body);

    if (body.status === "INACTIVE" && id === req.admin!.id) {
      throw new ApiError(400, "You cannot deactivate your own account");
    }

    if (body.restaurantIds) {
      await prisma.adminRestaurant.deleteMany({ where: { adminId: id } });
    }

    const admin = await prisma.adminUser.update({
      where: { id },
      data: {
        name: body.name,
        role: body.role,
        status: body.status,
        passwordHash: body.password ? await bcrypt.hash(body.password, 12) : undefined,
        restaurants: body.restaurantIds ? { create: body.restaurantIds.map((restaurantId) => ({ restaurantId })) } : undefined,
      },
      select: adminSelect,
    });
    sendSuccess(res, admin, "Admin updated");
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    if (id === req.admin!.id) throw new ApiError(400, "You cannot deactivate your own account");
    await prisma.adminUser.update({ where: { id }, data: { status: "INACTIVE" } });
    sendSuccess(res, {}, "Admin deactivated");
  }),
);

// Hard delete. Admins hold no booking/payment history, so they are always removed for real;
// restaurant assignments cascade. The last active SuperAdmin can never be removed.
router.delete(
  "/:id/permanent",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    if (id === req.admin!.id) throw new ApiError(400, "You cannot delete your own account");
    const admin = await prisma.adminUser.findUnique({ where: { id } });
    if (!admin) throw new ApiError(404, "Admin not found");
    if (admin.role === "SUPERADMIN" && admin.status === "ACTIVE") {
      const activeSuperAdmins = await prisma.adminUser.count({ where: { role: "SUPERADMIN", status: "ACTIVE" } });
      if (activeSuperAdmins <= 1) throw new ApiError(409, "Cannot delete the last active SuperAdmin");
    }
    await prisma.adminUser.delete({ where: { id } });
    sendSuccess(res, { deleted: true, deactivated: false }, "Admin deleted permanently");
  }),
);

export default router;
