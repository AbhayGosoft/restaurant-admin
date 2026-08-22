import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";

const router = Router();
const amenitySchema = z.object({
  name: z.string().min(2),
  icon: z.string().optional(),
  appliesTo: z.enum(["STAY", "ROOM", "BOTH"]).default("BOTH"),
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const amenities = await prisma.amenity.findMany({ orderBy: { name: "asc" } });
    res.json(amenities);
  }),
);

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(amenitySchema, req.body);
    const amenity = await prisma.amenity.upsert({
      where: { name: body.name },
      create: body,
      update: { icon: body.icon, appliesTo: body.appliesTo },
    });
    res.status(201).json(amenity);
  }),
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const amenity = await prisma.amenity.findUnique({ where: { id: idParam(req) } });
    if (!amenity) throw new ApiError(404, "Amenity not found");
    res.json(amenity);
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(amenitySchema.partial(), req.body);
    const existing = await prisma.amenity.findUnique({ where: { id: idParam(req) } });
    if (!existing) throw new ApiError(404, "Amenity not found");
    const amenity = await prisma.amenity.update({
      where: { id: existing.id },
      data: body,
    });
    res.json(amenity);
  }),
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.amenity.findUnique({ where: { id: idParam(req) } });
    if (!existing) throw new ApiError(404, "Amenity not found");
    await prisma.amenity.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);

export default router;
