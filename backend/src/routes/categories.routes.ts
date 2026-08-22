import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { advanceSetupStep } from "../services/setupService.js";
import { assertPropertyAccess } from "../services/propertyAccessService.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";
import { listQuerySchema, pagination, slugify } from "../utils/query.js";
import { imageUrlSchema } from "../utils/images.js";

const router = Router();

const categorySelect = {
  id: true,
  propertyId: true,
  name: true,
  slug: true,
  description: true,
  featuredImage: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { roomTypes: true } },
};

const categorySchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
  featuredImage: imageUrlSchema.optional(),
  isActive: z.boolean().default(true),
});

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    if (query.propertyId) {
      await assertPropertyAccess(req.user!.id, req.user!.role, query.propertyId);
    }

    const where = {
      deletedAt: null,
      propertyId: query.propertyId,
      isActive: query.isActive,
      property: req.user!.role === "ADMIN" ? undefined : { ownerId: req.user!.id },
      OR: query.search
        ? [{ name: { contains: query.search } }, { description: { contains: query.search } }]
        : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.propertyCategory.findMany({
        where,
        select: categorySelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.propertyCategory.count({ where }),
    ]);

    res.json({ data: items, pagination: pagination(query.page, query.limit, total) });
  }),
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(categorySchema, req.body);
    const property = await assertPropertyAccess(req.user!.id, req.user!.role, body.propertyId);
    const slug = body.slug ?? slugify(body.name);

    const category = await prisma.propertyCategory.create({
      data: { ...body, slug },
      select: categorySelect,
    });

    if (req.user!.role === "OWNER" && property.ownerId === req.user!.id) {
      await advanceSetupStep(req.user!.id, "CATEGORY");
    }

    res.status(201).json(category);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const category = await prisma.propertyCategory.findFirst({
      where: {
        id: idParam(req),
        deletedAt: null,
        property: req.user!.role === "ADMIN" ? undefined : { ownerId: req.user!.id },
      },
      select: categorySelect,
    });
    if (!category) throw new ApiError(404, "Category not found");
    res.json(category);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.propertyCategory.findUnique({ where: { id: idParam(req) } });
    if (!existing || existing.deletedAt) throw new ApiError(404, "Category not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, existing.propertyId);
    const body = validateBody(categorySchema.partial().omit({ propertyId: true }), req.body);

    const category = await prisma.propertyCategory.update({
      where: { id: existing.id },
      data: { ...body, slug: body.slug ?? (body.name ? slugify(body.name) : undefined) },
      select: categorySelect,
    });

    res.json(category);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const category = await prisma.propertyCategory.findUnique({
      where: { id: idParam(req) },
      select: { id: true, propertyId: true, _count: { select: { roomTypes: true } } },
    });
    if (!category) throw new ApiError(404, "Category not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, category.propertyId);
    if (category._count.roomTypes > 0) throw new ApiError(409, "Category has room types and cannot be deleted");

    await prisma.propertyCategory.update({ where: { id: category.id }, data: { deletedAt: new Date(), isActive: false } });
    res.status(204).send();
  }),
);

export default router;
