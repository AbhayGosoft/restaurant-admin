import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdminAuth, signAdminToken } from "../../middleware/auth.js";
import { ApiError, asyncHandler, sendSuccess, validateBody } from "../../utils/http.js";

const router = Router();

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

const adminSummary = (admin: { id: string; name: string; email: string; role: string; status: string }) => ({
  id: admin.id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  status: admin.status,
});

// OpenAPI docs: src/docs/admin/auth.docs.ts
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = validateBody(loginSchema, req.body);
    const admin = await prisma.adminUser.findUnique({ where: { email: body.email } });
    if (!admin || admin.status !== "ACTIVE") throw new ApiError(401, "Invalid email or password");

    const valid = await bcrypt.compare(body.password, admin.passwordHash);
    if (!valid) throw new ApiError(401, "Invalid email or password");

    const token = signAdminToken({ sub: admin.id, email: admin.email, role: admin.role });
    sendSuccess(res, { token, admin: adminSummary(admin) }, "Login successful");
  }),
);

router.get(
  "/me",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.id } });
    sendSuccess(res, adminSummary(admin));
  }),
);

router.patch(
  "/change-password",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const body = validateBody(
      z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }),
      req.body,
    );
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.id } });
    const valid = await bcrypt.compare(body.currentPassword, admin.passwordHash);
    if (!valid) throw new ApiError(401, "Current password is incorrect");

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash: await bcrypt.hash(body.newPassword, 12) },
    });
    sendSuccess(res, {}, "Password changed");
  }),
);

export default router;
