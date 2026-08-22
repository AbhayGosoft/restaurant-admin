import { Router } from "express";
import { requireAdapterKey } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { ApiError, asyncHandler, validateBody } from "../utils/http.js";
import { resolveAssetUrl } from "../utils/images.js";
import { calculateRate } from "../services/ratePlanService.js";
import { eachBookedNight, parseDateOnly } from "../utils/dates.js";
import { adapterBookingSchema, createPendingAdapterBooking } from "../services/adapterBookingService.js";
import { rejectBooking } from "../services/bookingLifecycleService.js";

const router = Router();

router.use(requireAdapterKey);

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
};

const gstPercent = (gstType: string) => {
  if (gstType === "GST_5") return "5.00";
  if (gstType === "GST_12") return "12.00";
  if (gstType === "GST_18") return "18.00";
  return null;
};

const propertyType = (type: string) => {
  if (type === "HOTEL") return "hotel";
  if (type === "RESORT") return "resort";
  if (type === "DHARAMSHALA") return "dharamshala";
  if (type === "HOMESTAY") return "homestay";
  if (type === "AIRBNB") return "guesthouse";
  if (type === "ASHRAM") return "ashram";
  return "other";
};

const knownPolicies = (checkInTime: string, checkOutTime: string) => ({
  checkIn: { time: checkInTime },
  checkOut: { time: checkOutTime },
});

const queryString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const propertyIdFromQuery = (query: Record<string, unknown>) =>
  queryString(query.property_id) ?? queryString(query.propertyId);

const pmsBookingStatus = (status: string) => {
  if (status === "CONFIRMED") return "confirmed";
  if (status === "CHECKED_IN") return "checked_in";
  if (["CANCELLED", "REJECTED", "AUTO_CANCELLED", "EXPIRED"].includes(status)) return "cancelled";
  if (status === "COMPLETED") return "checked_out";
  return "pending";
};

router.get(
  "/catalog",
  asyncHandler(async (req, res) => {
    const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
    const stays = await prisma.stayProfile.findMany({
      where: { ownerId, status: "ACTIVE" },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        amenities: { include: { amenity: true } },
        images: true,
        rooms: {
          where: { status: "ACTIVE" },
          include: { amenities: { include: { amenity: true } }, images: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ stays });
  }),
);

router.get(
  "/property",
  asyncHandler(async (req, res) => {
    const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
    const propertyId = propertyIdFromQuery(req.query);

    const property = await prisma.stayProfile.findFirst({
      where: { id: propertyId, ownerId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        addressLine: true,
        addressLine2: true,
        city: true,
        state: true,
        country: true,
        pincode: true,
        latitude: true,
        longitude: true,
        contactNumber: true,
        website: true,
        starRating: true,
        checkInTime: true,
        checkOutTime: true,
        taxesIncluded: true,
        taxPercent: true,
        cancellationFeePercent: true,
        facilities: true,
        nearByPlaces: true,
        owner: { select: { email: true } },
        images: { select: { imageUrl: true, isCover: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
        amenities: { select: { amenity: { select: { name: true } } } },
        rooms: { where: { status: "ACTIVE" }, select: { id: true } },
        roomTypes: {
          where: { isActive: true, deletedAt: null },
          select: { id: true, pricePerNight: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!property) {
      throw new ApiError(404, "Property not found");
    }

    const sortedImages = property.images.map((image) => resolveAssetUrl(image.imageUrl)).filter((url): url is string => Boolean(url));
    const thumbnail = resolveAssetUrl(property.images.find((image) => image.isCover)?.imageUrl) ?? sortedImages[0] ?? "";
    const startingPrice =
      property.roomTypes.length > 0
        ? Math.min(...property.roomTypes.map((roomType) => Number(roomType.pricePerNight))).toFixed(2)
        : "0.00";

    res.json({
      name: property.name,
      property_type: propertyType(property.type),
      description: property.description ?? `${property.name} in ${property.city}.`,
      short_description: property.description?.slice(0, 140) ?? `${propertyType(property.type)} in ${property.city}`,
      address: property.addressLine,
      address_line_2: property.addressLine2 ?? undefined,
      city: property.city,
      state: property.state,
      country: property.country ?? "India",
      pincode: property.pincode,
      latitude: property.latitude ? Number(property.latitude).toFixed(6) : null,
      longitude: property.longitude ? Number(property.longitude).toFixed(6) : null,
      contact_number: property.contactNumber,
      email: property.owner.email,
      website: property.website ?? undefined,
      star_rating: property.starRating ?? undefined,
      total_rooms: property.rooms.length,
      starting_price: startingPrice,
      currency: "INR",
      taxes_included: property.taxesIncluded,
      tax_percent: property.taxPercent ? Number(property.taxPercent) : undefined,
      cancellation_fee_percent: Number(property.cancellationFeePercent),
      check_in_time: property.checkInTime,
      check_out_time: property.checkOutTime,
      thumbnail,
      gallery: sortedImages.slice(0, 5),
      images: sortedImages,
      amenities: property.amenities.map((item) => item.amenity.name),
      facilities: asStringArray(property.facilities),
      near_by_places: Array.isArray(property.nearByPlaces) ? property.nearByPlaces : [],
      policies: knownPolicies(property.checkInTime, property.checkOutTime),
    });
  }),
);

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
    const propertyId = propertyIdFromQuery(req.query);

    const categories = await prisma.propertyCategory.findMany({
      where: {
        propertyId,
        isActive: true,
        deletedAt: null,
        property: { ownerId, status: "ACTIVE" },
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });

    res.json(
      categories.map((category) => ({
        category_id: category.id,
        name: category.name,
      })),
    );
  }),
);

router.get(
  "/room-types",
  asyncHandler(async (req, res) => {
    const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
    const propertyId = propertyIdFromQuery(req.query);

    const roomTypes = await prisma.roomType.findMany({
      where: {
        propertyId,
        isActive: true,
        deletedAt: null,
        property: { ownerId, status: "ACTIVE" },
      },
      select: {
        id: true,
        name: true,
        capacity: true,
        maxAdults: true,
        maxChildren: true,
        categoryId: true,
        description: true,
        sizeSqFt: true,
        bedType: true,
        floor: true,
        view: true,
        attachedBathroom: true,
        galleryImages: true,
        featuredImage: true,
        keyFeatures: true,
        pricePerNight: true,
        tax: { select: { percentage: true } },
        category: { select: { id: true, name: true } },
        amenities: { select: { amenity: { select: { name: true } } } },
        rooms: {
          where: { status: "ACTIVE", isBookable: true },
          select: { id: true, floor: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const response = roomTypes.map((roomType) => {
      const gallery = asStringArray(roomType.galleryImages).map((url) => resolveAssetUrl(url)).filter((url): url is string => Boolean(url));
      const resolvedFeaturedImage = resolveAssetUrl(roomType.featuredImage);
      const facilities = asStringArray(roomType.keyFeatures);
      const firstFloor = roomType.rooms.find((room) => room.floor)?.floor;
      const roomTypeFloor = roomType.floor ?? firstFloor ?? undefined;
      const startingPrice = Number(roomType.pricePerNight).toFixed(2);

      return {
        room_type_id: roomType.id,
        name: roomType.name,
        occupancy: roomType.capacity ?? 2,
        max_adult: roomType.maxAdults,
        max_child: roomType.maxChildren,
        category_id: roomType.categoryId,
        category_name: roomType.category.name,
        description: roomType.description ?? `${roomType.name} at ${roomType.category.name}`,
        room_size: roomType.sizeSqFt ? `${roomType.sizeSqFt} sq ft` : undefined,
        bed_type: roomType.bedType ?? undefined,
        floor: roomTypeFloor,
        view: roomType.view ?? undefined,
        bathroom: roomType.attachedBathroom ? "Attached, Western" : "Common Bathroom",
        gallery: gallery.length > 0 ? gallery : resolvedFeaturedImage ? [resolvedFeaturedImage] : [],
        amenities: roomType.amenities.map((item) => item.amenity.name),
        facilities,
        total_units: roomType.rooms.length,
        starting_price: Number(startingPrice),
        tax_rate: roomType.tax ? Number(roomType.tax.percentage) : 0,
      };
    });

    res.json(response);
  }),
);

router.get(
  "/rate-plans",
  asyncHandler(async (req, res) => {
    const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
    const propertyId = propertyIdFromQuery(req.query);

    const ratePlans = await prisma.ratePlan.findMany({
      where: {
        propertyId,
        isActive: true,
        deletedAt: null,
        property: { ownerId, status: "ACTIVE" },
      },
      select: {
        id: true,
        name: true,
        description: true,
        amountType: true,
        amountValue: true,
        isRefundable: true,
        mealPlan: true,
        freeCancellation: true,
        payAtHotel: true,
        advancePaymentPercent: true,
        cancellationPolicy: true,
        property: { select: { cancellationPolicy: true } },
        roomTypes: {
          select: {
            roomType: {
              select: {
                id: true,
                pricePerNight: true,
              },
            },
          },
        },
        services: {
          select: {
            service: {
              select: {
                id: true,
                title: true,
                price: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const response = ratePlans.map((ratePlan) => ({
      rate_plan_id: ratePlan.id,
      name: ratePlan.name,
      description: ratePlan.description || "No description provided.",
      is_refundable: ratePlan.isRefundable,
      meal_plan: ratePlan.mealPlan.toLowerCase(),
      free_cancellation: ratePlan.freeCancellation,
      pay_at_hotel: ratePlan.payAtHotel,
      advance_payment_percent: Number(ratePlan.advancePaymentPercent),
      cancellation_policy:
        ratePlan.cancellationPolicy || ratePlan.property.cancellationPolicy || "Standard cancellation policy applies as per property terms.",
      included_services: ratePlan.services.map(({ service }) => ({
        service_id: service.id,
        name: service.title,
        price: Number(service.price),
      })),
      room_types: ratePlan.roomTypes.map(({ roomType }) => {
        const basePrice = Number(roomType.pricePerNight);
        const finalPrice = calculateRate(basePrice, ratePlan.amountType, Number(ratePlan.amountValue));
        const rateAmount = Number((finalPrice - basePrice).toFixed(2));

        return {
          room_type_id: roomType.id,
          base_price: basePrice,
          rate_amount: rateAmount,
          final_price: finalPrice,
        };
      }),
    }));


    res.json(response);
  }),
);

router.get(
  "/extra-services",
  asyncHandler(async (req, res) => {
    const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
    const propertyId = propertyIdFromQuery(req.query);

    const services = await prisma.service.findMany({
      where: {
        propertyId,
        isAvailable: true,
        deletedAt: null,
        property: { ownerId, status: "ACTIVE" },
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        priceType: true,
        gstType: true,
        isMandatory: true,
        quantityAllowed: true,
        availableDays: true,
        validFrom: true,
        validTo: true,
        isAvailable: true,
        roomTypes: {
          select: {
            roomTypeId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      services.map((service) => ({
        service_id: service.id,
        name: service.title,
        price: Number(service.price),
        price_type: service.priceType.toLowerCase(),
        description: service.description ?? "",
        tax_rate: Number(gstPercent(service.gstType) ?? 0),
        is_mandatory: service.isMandatory,
        quantity_allowed: service.quantityAllowed ?? null,
        available_days: asStringArray(service.availableDays),
        valid_from: service.validFrom ? service.validFrom.toISOString().slice(0, 10) : null,
        valid_to: service.validTo ? service.validTo.toISOString().slice(0, 10) : null,
        room_type_ids: service.roomTypes.map(({ roomTypeId }) => roomTypeId),
      })),
    );
  }),
);

router.get(
  "/availability",
  asyncHandler(async (req, res) => {
    const propertyId = propertyIdFromQuery(req.query);
    const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
    const dateFrom = req.query.date_from ? parseDateOnly(String(req.query.date_from)) : undefined;
    const dateTo = req.query.date_to ? parseDateOnly(String(req.query.date_to)) : undefined;

    if (!propertyId) {
      throw new ApiError(400, "property_id is required");
    }
    if (!dateFrom || !dateTo) {
      throw new ApiError(400, "date_from and date_to are required");
    }

    const nights = eachBookedNight(dateFrom, dateTo);
    const roomTypes = await prisma.roomType.findMany({
      where: {
        propertyId,
        isActive: true,
        deletedAt: null,
        property: { ownerId, status: "ACTIVE" },
      },
      select: {
        id: true,
        pricePerNight: true,
        rooms: {
          where: { status: "ACTIVE", isBookable: true },
          select: {
            id: true,
            availability: {
              where: {
                date: { gte: dateFrom, lt: dateTo },
              },
              select: {
                date: true,
                status: true,
                priceOverride: true,
              },
            },
            blocks: {
              where: {
                startDate: { lt: dateTo },
                endDate: { gt: dateFrom },
              },
              select: { startDate: true, endDate: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const response = roomTypes.flatMap((roomType) =>
      nights.map((date) => {
        const dateKey = date.toISOString().slice(0, 10);
        const roomAvailabilityForDate = roomType.rooms
          .map((room) => room.availability.find((entry) => entry.date.toISOString().slice(0, 10) === dateKey))
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
        const unavailableRoomIds = new Set(
          roomType.rooms
            .filter((room) =>
              room.availability.some((entry) => entry.date.toISOString().slice(0, 10) === dateKey && entry.status !== "AVAILABLE") ||
              room.blocks.some((block) => block.startDate.toISOString().slice(0, 10) <= dateKey && dateKey < block.endDate.toISOString().slice(0, 10)),
            )
            .map((room) => room.id),
        );
        const overridePrices = roomAvailabilityForDate
          .map((entry) => entry.priceOverride)
          .filter((price): price is NonNullable<typeof price> => price !== null);
        const price =
          overridePrices.length > 0
            ? Math.min(...overridePrices.map((overridePrice) => Number(overridePrice)))
            : Number(roomType.pricePerNight);

        return {
          room_type_id: roomType.id,
          date: dateKey,
          units_available: Math.max(roomType.rooms.length - unavailableRoomIds.size, 0),
          price,
        };
      }),
    );

    res.json(response);
  }),
);

router.post(
  "/bookings",
  asyncHandler(async (req, res) => {
    const body = validateBody(adapterBookingSchema, req.body);
    const isCanonical = Boolean(body.external_room_type_id);
    const booking = await createPendingAdapterBooking(body);

    if (isCanonical) {
      res.status(201).json({
        pms_booking_id: booking.bookingRef,
        status: pmsBookingStatus(booking.bookingStatus),
        price: Number(booking.totalAmount),
      });
      return;
    }

    res.status(201).json(booking);
  }),
);

router.post(
  "/bookings/:pmsBookingId/cancel",
  asyncHandler(async (req, res) => {
    const pmsBookingId = String(req.params.pmsBookingId);
    const booking = await prisma.booking.findUnique({
      where: { bookingRef: pmsBookingId },
      select: { id: true, bookingRef: true, bookingStatus: true, totalAmount: true },
    });
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    await rejectBooking(booking.id, { type: "ADAPTER" }, "CANCELLED", { syncAdapter: false });

    res.json({ pms_booking_id: booking.bookingRef, status: "cancelled", price: Number(booking.totalAmount) });
  }),
);

router.get(
  "/bookings/:pmsBookingId",
  asyncHandler(async (req, res) => {
    const pmsBookingId = String(req.params.pmsBookingId);
    const booking = await prisma.booking.findUnique({
      where: { bookingRef: pmsBookingId },
      select: {
        bookingRef: true,
        bookingStatus: true,
        totalAmount: true,
      },
    });
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    res.json({
      pms_booking_id: booking.bookingRef,
      status: pmsBookingStatus(booking.bookingStatus),
      price: Number(booking.totalAmount),
    });
  }),
);

export default router;
