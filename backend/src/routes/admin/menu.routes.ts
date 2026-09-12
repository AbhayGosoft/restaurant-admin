import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdminAuth, requireRestaurantAccess } from "../../middleware/auth.js";
import { imageUrlSchema, resolveAssetUrl } from "../../utils/images.js";
import { ApiError, asyncHandler, idParam, sendSuccess, validateBody } from "../../utils/http.js";

// Mounted at /api/admin/restaurants/:restaurantId/menu (mergeParams so :restaurantId is visible here).
// OpenAPI docs: src/docs/admin/menu.docs.ts
const router = Router({ mergeParams: true });
router.use(requireAdminAuth, requireRestaurantAccess("restaurantId"));

const toItem = (item: any) => ({
  id: item.id,
  name: item.name,
  description: item.description,
  price: Number(item.price),
  image: resolveAssetUrl(item.image ?? undefined) ?? null,
  isVeg: item.isVeg,
  isActive: item.isActive,
  sortOrder: item.sortOrder,
});

const toCategory = (category: any) => ({
  id: category.id,
  name: category.name,
  sortOrder: category.sortOrder,
  isActive: category.isActive,
  items: category.items?.map(toItem) ?? [],
});

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req, "restaurantId");
    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: "asc" },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    sendSuccess(res, categories.map(toCategory));
  }),
);

const categorySchema = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

router.post(
  "/categories",
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req, "restaurantId");
    const body = validateBody(categorySchema, req.body);
    const category = await prisma.menuCategory.create({ data: { ...body, restaurantId } });
    sendSuccess(res, toCategory({ ...category, items: [] }), "Menu category created", 201);
  }),
);

const assertCategoryInRestaurant = async (restaurantId: string, categoryId: string) => {
  const category = await prisma.menuCategory.findFirst({ where: { id: categoryId, restaurantId } });
  if (!category) throw new ApiError(404, "Menu category not found");
  return category;
};

router.patch(
  "/categories/:categoryId",
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req, "restaurantId");
    const categoryId = idParam(req, "categoryId");
    await assertCategoryInRestaurant(restaurantId, categoryId);
    const body = validateBody(categorySchema.partial(), req.body);
    const category = await prisma.menuCategory.update({
      where: { id: categoryId },
      data: body,
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    sendSuccess(res, toCategory(category), "Menu category updated");
  }),
);

router.delete(
  "/categories/:categoryId",
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req, "restaurantId");
    const categoryId = idParam(req, "categoryId");
    await assertCategoryInRestaurant(restaurantId, categoryId);
    await prisma.menuCategory.update({ where: { id: categoryId }, data: { isActive: false } });
    sendSuccess(res, {}, "Menu category deactivated");
  }),
);

const itemSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  price: z.coerce.number().min(0),
  image: imageUrlSchema.optional(),
  isVeg: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

router.post(
  "/categories/:categoryId/items",
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req, "restaurantId");
    const categoryId = idParam(req, "categoryId");
    await assertCategoryInRestaurant(restaurantId, categoryId);
    const body = validateBody(itemSchema, req.body);
    const item = await prisma.menuItem.create({ data: { ...body, menuCategoryId: categoryId } });
    sendSuccess(res, toItem(item), "Menu item created", 201);
  }),
);

const assertItemInRestaurant = async (restaurantId: string, itemId: string) => {
  const item = await prisma.menuItem.findFirst({ where: { id: itemId, menuCategory: { restaurantId } } });
  if (!item) throw new ApiError(404, "Menu item not found");
  return item;
};

router.patch(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req, "restaurantId");
    const itemId = idParam(req, "itemId");
    await assertItemInRestaurant(restaurantId, itemId);
    const body = validateBody(itemSchema.partial(), req.body);
    const item = await prisma.menuItem.update({ where: { id: itemId }, data: body });
    sendSuccess(res, toItem(item), "Menu item updated");
  }),
);

router.delete(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const restaurantId = idParam(req, "restaurantId");
    const itemId = idParam(req, "itemId");
    await assertItemInRestaurant(restaurantId, itemId);
    await prisma.menuItem.update({ where: { id: itemId }, data: { isActive: false } });
    sendSuccess(res, {}, "Menu item deactivated");
  }),
);

export default router;
