import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { assertPropertyAccess } from "../services/propertyAccessService.js";
import { ApiError, asyncHandler, idParam, validateBody } from "../utils/http.js";
import { booleanQueryParam, listQuerySchema, pagination } from "../utils/query.js";

const router = Router();

const policySelect = {
  id: true,
  propertyId: true,
  type: true,
  title: true,
  content: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const policyBaseSchema = z.object({
  propertyId: z.string().uuid(),
  type: z.enum(["CANCELLATION", "HOUSE_RULE"]),
  title: z.string().min(2),
  content: z.string().min(2),
  isActive: z.boolean(),
});

const policyCreateSchema = policyBaseSchema.extend({
  isActive: z.boolean().default(true),
});
const policyUpdateSchema = policyBaseSchema.omit({ propertyId: true }).partial();

router.use(requireAuth);

router.get(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.extend({ isActive: booleanQueryParam.optional(), type: z.enum(["CANCELLATION", "HOUSE_RULE"]).optional() }).parse(req.query);
    if (query.propertyId) await assertPropertyAccess(req.user!.id, req.user!.role, query.propertyId);

    const where = {
      deletedAt: null,
      propertyId: query.propertyId,
      type: query.type,
      isActive: query.isActive,
      OR: query.search ? [{ title: { contains: query.search } }, { content: { contains: query.search } }] : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.propertyPolicy.findMany({
        where,
        select: policySelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
      }),
      prisma.propertyPolicy.count({ where }),
    ]);

    res.json({ data: items, pagination: pagination(query.page, query.limit, total) });
  }),
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = validateBody(policyCreateSchema, req.body);
    await assertPropertyAccess(req.user!.id, req.user!.role, body.propertyId);
    const policy = await prisma.propertyPolicy.create({ data: body, select: policySelect });
    res.status(201).json(policy);
  }),
);

router.put(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.propertyPolicy.findUnique({ where: { id: idParam(req) } });
    if (!existing || existing.deletedAt) throw new ApiError(404, "Policy not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, existing.propertyId);
    const body = validateBody(policyUpdateSchema, req.body);
    const policy = await prisma.propertyPolicy.update({ where: { id: existing.id }, data: body, select: policySelect });
    res.json(policy);
  }),
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const policy = await prisma.propertyPolicy.findUnique({ where: { id: idParam(req) } });
    if (!policy || policy.deletedAt) throw new ApiError(404, "Policy not found");
    await assertPropertyAccess(req.user!.id, req.user!.role, policy.propertyId);
    await prisma.propertyPolicy.update({ where: { id: policy.id }, data: { deletedAt: new Date(), isActive: false } });
    res.status(204).send();
  }),
);

export default router;
