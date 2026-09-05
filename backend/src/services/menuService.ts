import { prisma } from "../lib/prisma.js";
import { resolveAssetUrl } from "../utils/images.js";

export const getMenu = async (restaurantId: string) => {
  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  return categories.map((category) => ({
    category: category.name,
    items: category.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      image: resolveAssetUrl(item.image ?? undefined) ?? null,
      isVeg: item.isVeg,
    })),
  }));
};
