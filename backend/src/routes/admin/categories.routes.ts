import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdminAuth, requireSuperAdmin } from "../../middleware/auth.js";
import { ApiError, asyncHandler, idParam, sendSuccess, validateBody } from "../../utils/http.js";
import { slugify } from "../../utils/query.js";

const router = Router();

// OpenAPI docs: src/docs/admin/categories.docs.ts
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

// Hard delete. Categories carry no booking history — restaurant links cascade away.
router.delete(
  "/:id/permanent",
  asyncHandler(async (req, res) => {
    const id = idParam(req);
    const category = await prisma.restaurantCategory.findUnique({ where: { id } });
    if (!category) throw new ApiError(404, "Category not found");
    await prisma.restaurantCategory.delete({ where: { id } });
    sendSuccess(res, { deleted: true, deactivated: false }, "Category deleted permanently");
  }),
);

export default router;
