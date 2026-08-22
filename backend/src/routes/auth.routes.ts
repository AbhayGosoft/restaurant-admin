import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, signAuthToken } from "../middleware/auth.js";
import { ApiError, asyncHandler, validateBody } from "../utils/http.js";

const router = Router();

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = validateBody(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || user.status !== "ACTIVE") {
      throw new ApiError(401, "Invalid email or password");
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const token = signAuthToken({ sub: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        mustResetPassword: user.mustResetPassword,
        setupCompleted: user.setupCompleted,
        currentStep: user.currentStep,
      },
    });
  }),
);

const meSelect = {
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
} as const;

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: meSelect,
    });
    res.json(user);
  }),
);

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  businessName: z.string().max(255).optional(),
  avatarUrl: z.string().max(1024).nullable().optional(),
});

router.patch(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = validateBody(updateProfileSchema, req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name: body.name,
        businessName: body.businessName,
        avatarUrl: body.avatarUrl,
      },
      select: meSelect,
    });
    res.json(user);
  }),
);

router.patch(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = validateBody(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      }),
      req.body,
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Current password is incorrect");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(body.newPassword, 12),
        mustResetPassword: false,
      },
    });

    res.json({ message: "Password changed" });
  }),
);

export default router;
