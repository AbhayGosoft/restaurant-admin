import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/http.js";
import { haversineDistanceKm } from "../utils/geo.js";
import { resolveAssetUrl } from "../utils/images.js";
import { pagination } from "../utils/query.js";

const restaurantInclude = {
  categories: { include: { category: true } },
} satisfies Prisma.RestaurantInclude;

type RestaurantWithCategories = Prisma.RestaurantGetPayload<{ include: typeof restaurantInclude }>;

const toPublicRestaurant = (restaurant: RestaurantWithCategories, userLocation?: { latitude: number; longitude: number }) => ({
  id: restaurant.id,
  name: restaurant.name,
  banner: resolveAssetUrl(restaurant.banner ?? undefined) ?? null,
  gallery: ((restaurant.gallery as string[] | null) ?? []).map((url) => resolveAssetUrl(url)),
  categories: restaurant.categories.map((link) => link.category.key),
  cuisineLabel: restaurant.cuisineLabel,
  isPureVeg: restaurant.isPureVeg,
  rating: Number(restaurant.rating),
  ratingCount: restaurant.ratingCount,
  prepTimeMin: restaurant.prepTimeMin,
  prepTimeMax: restaurant.prepTimeMax,
  priceForTwo: restaurant.priceForTwo,
  offerText: restaurant.offerText,
  offerSubText: restaurant.offerSubText,
  about: restaurant.about,
  address: {
    line: restaurant.addressLine,
    city: restaurant.city,
    state: restaurant.state,
    country: restaurant.country,
    pincode: restaurant.pincode,
  },
  phone: restaurant.phone,
  latitude: Number(restaurant.latitude),
  longitude: Number(restaurant.longitude),
  maxPartySize: restaurant.maxPartySize,
  distanceKm:
    userLocation && Number.isFinite(userLocation.latitude) && Number.isFinite(userLocation.longitude)
      ? haversineDistanceKm(userLocation, { latitude: Number(restaurant.latitude), longitude: Number(restaurant.longitude) })
      : null,
});

export type ListRestaurantsInput = {
  city?: string;
  category?: string;
  q?: string;
  latitude?: number;
  longitude?: number;
  page: number;
  limit: number;
};

export const listRestaurants = async (input: ListRestaurantsInput) => {
  const where: Prisma.RestaurantWhereInput = {
    status: "ACTIVE",
    ...(input.city ? { city: { equals: input.city } } : {}),
    ...(input.category ? { categories: { some: { category: { key: input.category } } } } : {}),
    ...(input.q
      ? {
          OR: [
            { name: { contains: input.q } },
            { cuisineLabel: { contains: input.q } },
          ],
        }
      : {}),
  };

  const [restaurants, total] = await Promise.all([
    prisma.restaurant.findMany({
      where,
      include: restaurantInclude,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.restaurant.count({ where }),
  ]);

  const userLocation =
    input.latitude !== undefined && input.longitude !== undefined ? { latitude: input.latitude, longitude: input.longitude } : undefined;

  return {
    restaurants: restaurants.map((restaurant) => toPublicRestaurant(restaurant, userLocation)),
    pagination: pagination(input.page, input.limit, total),
  };
};

export const getRestaurantDetail = async (id: string, userLocation?: { latitude: number; longitude: number }) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { id }, include: restaurantInclude });
  if (!restaurant || restaurant.status !== "ACTIVE") throw new ApiError(404, "Restaurant not found");
  return toPublicRestaurant(restaurant, userLocation);
};

/** Internal helper for services that need the raw record (booking, admin, slots). */
export const getActiveRestaurantOrThrow = async (id: string) => {
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant || restaurant.status !== "ACTIVE") throw new ApiError(404, "Restaurant not found");
  return restaurant;
};
