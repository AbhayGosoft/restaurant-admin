import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { assertPropertyAccess } from "../services/propertyAccessService.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";
import { booleanQueryParam, listQuerySchema, pagination } from "../utils/query.js";

const router = Router();

const taxSelect = {
  id: true,
  propertyId: true,
  name: true,
  type: true,
  percentage: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const taxBaseSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(2),
  type: z.enum(["GST", "SERVICE_TAX", "OTHER"]),
  percentage: z.coerce.number().min(0).max(100),
  description: z.string().optional(),
  isActive: z.boolean(),
});

const taxCreateSchema = taxBaseSchema.extend({
  type: z.enum(["GST", "SERVICE_TAX", "OTHER"]).default("GST"),
  isActive: z.boolean().default(true),
});
const taxUpdateSchema = taxBaseSchema.omit({ propertyId: true }).partial();

router.use(requireAuth);

router.get(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.extend({ isActive: booleanQueryParam.optional(), type: z.enum(["GST", "SERVICE_TAX", "OTHER"]).optional() }).parse(req.query);
    if (query.propertyId) await assertPropertyAccess(req.user!.id, req.user!.role, query.propertyId);

    const where = {
      deletedAt: null,
      propertyId: query.propertyId,
      type: query.type,
      isActive: query.isActive,
      OR: query.search ? [{ name: { contains: query.search } }, { description: { contains: query.search } }] : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.propertyTax.findMany({
        where,
        select: taxSelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.propertyTax.count({ where }),
    ]);

    res.json({ data: items, pagination: pagination(query.page, query.limit, total) });
  }),
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(taxCreateSchema, req.body);
    await assertPropertyAccess(req.user!.id, req.user!.role, body.propertyId);
    const tax = await prisma.propertyTax.create({ data: body, select: taxSelect });
    res.status(201).json(tax);
  }),
);

router.put(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.propertyTax.findUnique({ where: { id: idParam(req) } });
    if (!existing || existing.deletedAt) throw new ApiError(404, "Tax not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, existing.propertyId);
    const body = validateBody(taxUpdateSchema, req.body);
    const tax = await prisma.propertyTax.update({ where: { id: existing.id }, data: body, select: taxSelect });
    res.json(tax);
  }),
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const tax = await prisma.propertyTax.findUnique({ where: { id: idParam(req) } });
    if (!tax || tax.deletedAt) throw new ApiError(404, "Tax not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, tax.propertyId);
    await prisma.propertyTax.update({ where: { id: tax.id }, data: { deletedAt: new Date(), isActive: false } });
    res.status(204).send();
  }),
);

export default router;
