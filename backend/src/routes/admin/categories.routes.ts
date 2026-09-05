import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdminAuth, requireSuperAdmin } from "../../middleware/auth.js";
import { asyncHandler, idParam, sendSuccess, validateBody } from "../../utils/http.js";
import { slugify } from "../../utils/query.js";

const router = Router();

router.get(
  "/",
  requireAdminAuth,
  asyncHandler(async (_req, res) => {
    const categories = await prisma.restaurantCategory.findMany({ orderBy: { sortOrder: "asc" } });
    sendSuccess(res, categories);
  }),
);

router.use(requireAdminAuth, requireSuperAdmin);

const upsertSchema = z.object({
  label: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = validateBody(upsertSchema, req.body);
    const category = await prisma.restaurantCategory.create({
      data: { key: slugify(body.label).replace(/-/g, "_"), label: body.label, sortOrder: body.sortOrder, isActive: body.isActive },
    });
    sendSuccess(res, category, "Category created", 201);
  }),
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const body = validateBody(upsertSchema.partial(), req.body);
    const category = await prisma.restaurantCategory.update({ where: { id }, data: body });
    sendSuccess(res, category, "Category updated");
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    await prisma.restaurantCategory.update({ where: { id }, data: { isActive: false } });
    sendSuccess(res, {}, "Category deactivated");
  }),
);

export default router;
