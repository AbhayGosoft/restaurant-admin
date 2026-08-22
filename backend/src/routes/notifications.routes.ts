import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError, asyncHandler, validateBody } from "../utils/http.js";

const router = Router();
const pushDeviceSchema = z.object({
  token: z.string().min(20).max(512),
  platform: z.string().min(2).max(30).default("android"),
  deviceId: z.string().max(191).optional(),
});

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(notifications);
  }),
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await prisma.notification.updateMany({
      where: { id, userId: req.user!.id },
      data: { isRead: true },
    });
    if (result.count !== 1) throw new ApiError(404, "Notification not found");
    const notification = await prisma.notification.findUniqueOrThrow({ where: { id } });
    res.json(notification);
  }),
);

router.post(
  "/devices",
  asyncHandler(async (req, res) => {
    const body = validateBody(pushDeviceSchema, req.body);
    const update = {
      userId: req.user!.id,
      platform: body.platform,
      deviceId: body.deviceId,
      isActive: true,
    };
    let device;
    try {
      device = await prisma.pushDevice.upsert({
        where: { token: body.token },
        update,
        create: { ...update, token: body.token },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        device = await prisma.pushDevice.update({ where: { token: body.token }, data: update });
      } else {
        throw error;
      }
    }
    res.status(201).json({ id: device.id, isActive: device.isActive });
  }),
);

router.delete(
  "/devices/:token",
  asyncHandler(async (req, res) => {
    await prisma.pushDevice.updateMany({
      where: { token: String(req.params.token), userId: req.user!.id },
      data: { isActive: false },
    });
    res.status(204).send();
  }),
);

export default router;
