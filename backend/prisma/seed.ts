import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase() ?? "sample.owner@darshan.local";
const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "Sample@12345";
const propertyName = "Shree Darshan Sample Stay";

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const upsertPropertyScoped = async <T extends { id: string }>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
  update: (id: string) => Promise<T>,
) => {
  const existing = await find();
  return existing ? update(existing.id) : create();
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL before running the seed.");
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      name: "Sample Stay Owner",
      phone: "9000001001",
      businessName: "Darshan Demo Hospitality",
      role: "OWNER",
      status: "ACTIVE",
      passwordHash,
      mustResetPassword: false,
      setupCompleted: true,
      currentStep: "COMPLETED",
    },
    create: {
      name: "Sample Stay Owner",
      email: ownerEmail,
      phone: "9000001001",
      businessName: "Darshan Demo Hospitality",
      role: "OWNER",
      status: "ACTIVE",
      passwordHash,
      mustResetPassword: false,
      setupCompleted: true,
      currentStep: "COMPLETED",
    },
  });

  const property = await upsertPropertyScoped(
    () => prisma.stayProfile.findFirst({ where: { ownerId: owner.id, name: propertyName } }),
    () =>
      prisma.stayProfile.create({
        data: {
          ownerId: owner.id,
          name: propertyName,
          type: "DHARAMSHALA",
          description: "Seeded demo property for end-to-end booking, rate plan, tax, service, and availability testing.",
          cancellationPolicy: "Free cancellation until 24 hours before check-in. One night may be charged after that.",
          houseRules: "Valid ID required for every adult guest. Quiet hours after 10 PM.",
          addressLine: "Mandir Road, Near Main Gate",
          city: "Ahmedabad",
          state: "Gujarat",
          country: "India",
          pincode: "380001",
          latitude: "23.0225000",
          longitude: "72.5714000",
          contactNumber: "9000001002",
          checkInTime: "12:00",
          checkOutTime: "10:00",
          status: "ACTIVE",
        },
      }),
    (id) =>
      prisma.stayProfile.update({
        where: { id },
        data: {
          description: "Seeded demo property for end-to-end booking, rate plan, tax, service, and availability testing.",
          cancellationPolicy: "Free cancellation until 24 hours before check-in. One night may be charged after that.",
          houseRules: "Valid ID required for every adult guest. Quiet hours after 10 PM.",
          status: "ACTIVE",
        },
      }),
  );

  const amenityNames = [
    ["Wi-Fi", "wifi", "BOTH"],
    ["Parking", "parking-circle", "STAY"],
    ["Hot Water", "shower-head", "ROOM"],
    ["Air Conditioning", "snowflake", "ROOM"],
    ["Breakfast", "coffee", "BOTH"],
    ["Temple View", "landmark", "ROOM"],
  ] as const;

  const amenities = await Promise.all(
    amenityNames.map(([name, icon, appliesTo]) =>
      prisma.amenity.upsert({
        where: { name },
        update: { icon, appliesTo },
        create: { name, icon, appliesTo },
      }),
    ),
  );

  await prisma.stayAmenity.deleteMany({ where: { stayProfileId: property.id } });
  await prisma.stayAmenity.createMany({
    data: amenities.slice(0, 3).map((amenity) => ({ stayProfileId: property.id, amenityId: amenity.id })),
    skipDuplicates: true,
  });

  await prisma.stayImage.deleteMany({ where: { stayProfileId: property.id } });
  await prisma.stayImage.createMany({
    data: [
      {
        stayProfileId: property.id,
        imageUrl: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1400&q=80",
        isCover: true,
        sortOrder: 0,
      },
      {
        stayProfileId: property.id,
        imageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80",
        isCover: false,
        sortOrder: 1,
      },
    ],
  });

  const taxes = await Promise.all(
    [
      ["GST 5%", "GST", "5.00", "Standard room GST slab"],
      ["GST 12%", "GST", "12.00", "Premium room GST slab"],
      ["Service GST 18%", "GST", "18.00", "Tax for selected extra services"],
    ].map(([name, type, percentage, description]) =>
      upsertPropertyScoped(
        () => prisma.propertyTax.findFirst({ where: { propertyId: property.id, name } }),
        () => prisma.propertyTax.create({ data: { propertyId: property.id, name, type: type as "GST", percentage, description, isActive: true } }),
        (id) => prisma.propertyTax.update({ where: { id }, data: { type: type as "GST", percentage, description, isActive: true, deletedAt: null } }),
      ),
    ),
  );
  const [gst5, gst12] = taxes;

  const categories = await Promise.all(
    [
      ["Standard Rooms", "Clean budget rooms for solo and two-person stays."],
      ["Family Rooms", "Larger rooms for families and small groups."],
      ["Dormitory", "Shared stay inventory for yatri and group bookings."],
      ["Premium Suites", "Higher comfort rooms for premium booking tests."],
    ].map(([name, description]) =>
      upsertPropertyScoped(
        () => prisma.propertyCategory.findFirst({ where: { propertyId: property.id, name } }),
        () =>
          prisma.propertyCategory.create({
            data: { propertyId: property.id, name, slug: slugify(name), description, isActive: true },
          }),
        (id) =>
          prisma.propertyCategory.update({
            where: { id },
            data: { slug: slugify(name), description, isActive: true, deletedAt: null },
          }),
      ),
    ),
  );

  const roomTypeSeeds = [
    {
      name: "Standard Double Non AC",
      category: categories[0],
      pricePerNight: "1200.00",
      capacity: 2,
      maxAdults: 2,
      maxChildren: 0,
      bedType: "Double Bed",
      acType: "Non AC",
      taxId: gst5.id,
      keyFeatures: ["Budget friendly", "Attached bathroom", "Hot water"],
      legacy: "DOUBLE",
    },
    {
      name: "Deluxe AC Triple",
      category: categories[1],
      pricePerNight: "2200.00",
      capacity: 3,
      maxAdults: 2,
      maxChildren: 1,
      bedType: "Queen Bed + Single Bed",
      acType: "AC",
      taxId: gst12.id,
      keyFeatures: ["Air conditioning", "Extra bedding", "Breakfast eligible"],
      legacy: "FAMILY",
    },
    {
      name: "Dormitory Bed",
      category: categories[2],
      pricePerNight: "450.00",
      capacity: 1,
      maxAdults: 1,
      maxChildren: 0,
      bedType: "Single Bed",
      acType: "Fan",
      taxId: gst5.id,
      keyFeatures: ["Shared stay", "Locker space", "Common washroom"],
      legacy: "DORM",
    },
    {
      name: "Premium Family Suite",
      category: categories[3],
      pricePerNight: "3800.00",
      capacity: 5,
      maxAdults: 3,
      maxChildren: 2,
      bedType: "King Bed + Sofa Bed",
      acType: "AC",
      taxId: gst12.id,
      keyFeatures: ["Separate sitting area", "Temple view", "Priority service"],
      legacy: "SUITE",
    },
  ] as const;

  const roomTypes = await Promise.all(
    roomTypeSeeds.map((seed) =>
      upsertPropertyScoped(
        () => prisma.roomType.findFirst({ where: { propertyId: property.id, name: seed.name } }),
        () =>
          prisma.roomType.create({
            data: {
              propertyId: property.id,
              categoryId: seed.category.id,
              name: seed.name,
              slug: slugify(seed.name),
              description: `${seed.name} seeded for booking flow testing.`,
              overview: "Demo inventory with mapped rooms, taxes, services, and rate plans.",
              keyFeatures: [...seed.keyFeatures],
              policies: { refundable: true, idRequired: true },
              pricePerNight: seed.pricePerNight,
              capacity: seed.capacity,
              maxAdults: seed.maxAdults,
              maxChildren: seed.maxChildren,
              taxId: seed.taxId,
              smokingAllowed: false,
              sizeSqFt: seed.capacity * 120,
              bedType: seed.bedType,
              acType: seed.acType,
              attachedBathroom: seed.legacy !== "DORM",
              featuredImage: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
              galleryImages: ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80"],
              isActive: true,
            },
          }),
        (id) =>
          prisma.roomType.update({
            where: { id },
            data: {
              categoryId: seed.category.id,
              slug: slugify(seed.name),
              description: `${seed.name} seeded for booking flow testing.`,
              overview: "Demo inventory with mapped rooms, taxes, services, and rate plans.",
              keyFeatures: [...seed.keyFeatures],
              policies: { refundable: true, idRequired: true },
              pricePerNight: seed.pricePerNight,
              capacity: seed.capacity,
              maxAdults: seed.maxAdults,
              maxChildren: seed.maxChildren,
              taxId: seed.taxId,
              smokingAllowed: false,
              sizeSqFt: seed.capacity * 120,
              bedType: seed.bedType,
              acType: seed.acType,
              attachedBathroom: seed.legacy !== "DORM",
              isActive: true,
              deletedAt: null,
            },
          }),
      ),
    ),
  );

  await prisma.roomTypeAmenity.deleteMany({ where: { roomTypeId: { in: roomTypes.map((roomType) => roomType.id) } } });
  await prisma.roomTypeAmenity.createMany({
    data: roomTypes.flatMap((roomType, index) =>
      amenities
        .filter((_, amenityIndex) => amenityIndex === 0 || amenityIndex === 2 || (index !== 2 && amenityIndex === 3) || (index === 3 && amenityIndex === 5))
        .map((amenity) => ({ roomTypeId: roomType.id, amenityId: amenity.id })),
    ),
    skipDuplicates: true,
  });

  const rooms = [
    ["STD-101", "G Floor", 0],
    ["STD-102", "G Floor", 0],
    ["STD-103", "G Floor", 0],
    ["DLX-201", "1st Floor", 1],
    ["DLX-202", "1st Floor", 1],
    ["DLX-203", "1st Floor", 1],
    ["DORM-A1", "Dorm Wing", 2],
    ["DORM-A2", "Dorm Wing", 2],
    ["DORM-A3", "Dorm Wing", 2],
    ["DORM-A4", "Dorm Wing", 2],
    ["SUITE-301", "2nd Floor", 3],
    ["SUITE-302", "2nd Floor", 3],
  ] as const;

  const seededRooms = await Promise.all(
    rooms.map(([roomNumber, floor, roomTypeIndex], index) => {
      const roomType = roomTypes[roomTypeIndex];
      const seed = roomTypeSeeds[roomTypeIndex];
      return upsertPropertyScoped(
        () => prisma.room.findFirst({ where: { stayProfileId: property.id, roomNumber } }),
        () =>
          prisma.room.create({
            data: {
              stayProfileId: property.id,
              roomTypeId: roomType.id,
              name: `${seed.name} ${roomNumber}`,
              roomType: seed.legacy,
              roomNumber,
              title: `${seed.name} ${roomNumber}`,
              floor,
              physicalStatus: index === 5 ? "MAINTENANCE" : "AVAILABLE",
              capacityAdults: seed.maxAdults,
              capacityChildren: seed.maxChildren,
              basePrice: roomType.pricePerNight,
              extraBedPrice: roomTypeIndex === 2 ? "0.00" : "350.00",
              gstType: roomTypeIndex > 0 ? "GST_12" : "GST_5",
              description: `Seed room ${roomNumber} mapped to ${seed.name}.`,
              isDefault: index === 0,
              isClean: index !== 5,
              isBookable: index !== 5,
              showOnWebsite: true,
            },
          }),
        (id) =>
          prisma.room.update({
            where: { id },
            data: {
              roomTypeId: roomType.id,
              name: `${seed.name} ${roomNumber}`,
              roomType: seed.legacy,
              title: `${seed.name} ${roomNumber}`,
              floor,
              physicalStatus: index === 5 ? "MAINTENANCE" : "AVAILABLE",
              capacityAdults: seed.maxAdults,
              capacityChildren: seed.maxChildren,
              basePrice: roomType.pricePerNight,
              extraBedPrice: roomTypeIndex === 2 ? "0.00" : "350.00",
              gstType: roomTypeIndex > 0 ? "GST_12" : "GST_5",
              description: `Seed room ${roomNumber} mapped to ${seed.name}.`,
              isDefault: index === 0,
              isClean: index !== 5,
              isBookable: index !== 5,
              showOnWebsite: true,
              status: "ACTIVE",
            },
          }),
      );
    }),
  );

  const serviceSeeds = [
    ["Breakfast Thali", "Fresh breakfast for one guest.", "180.00", "GST_5", [0, 1, 3]],
    ["Airport Pickup", "One-way pickup from airport or railway station.", "950.00", "GST_18", [1, 3]],
    ["Extra Mattress", "Additional bedding for eligible room types.", "350.00", "GST_12", [0, 1, 3]],
    ["Guided Temple Visit", "Local guided visit assistance.", "500.00", "GST_18", [0, 1, 2, 3]],
  ] as const;

  const services = await Promise.all(
    serviceSeeds.map(([title, description, price, gstType]) =>
      upsertPropertyScoped(
        () => prisma.service.findFirst({ where: { propertyId: property.id, title } }),
        () => prisma.service.create({ data: { propertyId: property.id, title, description, price, gstType, images: [], isAvailable: true } }),
        (id) => prisma.service.update({ where: { id }, data: { description, price, gstType, images: [], isAvailable: true, deletedAt: null } }),
      ),
    ),
  );

  await prisma.roomTypeService.deleteMany({ where: { serviceId: { in: services.map((service) => service.id) } } });
  await prisma.roomTypeService.createMany({
    data: serviceSeeds.flatMap((seed, serviceIndex) =>
      seed[4].map((roomTypeIndex) => ({
        serviceId: services[serviceIndex].id,
        roomTypeId: roomTypes[roomTypeIndex].id,
      })),
    ),
    skipDuplicates: true,
  });

  await prisma.ratePlan.deleteMany({
    where: {
      propertyId: property.id,
      name: { in: ["Weekday 8% Discount", "Dorm Group Offer"] },
      bookings: { none: {} },
    },
  });

  const ratePlanSeeds = [
    ["Standard Rate", "Base rate, all room types.", "FLAT", "0.00", "ALL", [], [0, 1, 2, 3], [0, 2]],
    ["Weekend 10% Increase", "Applies Friday and Saturday.", "PERCENTAGE", "10.00", "SPECIFIC_DAYS", [5, 6], [0, 1, 3], [0, 2, 3]],
    ["Weekday 8% Add-on", "Applies Monday to Thursday.", "PERCENTAGE", "8.00", "SPECIFIC_DAYS", [1, 2, 3, 4], [0, 1, 2], [0]],
    ["Festival Flat Add-on", "Date-range test plan.", "FLAT", "700.00", "DATE_RANGE", [], [1, 3], [0, 1, 2, 3]],
    ["Dorm Support Add-on", "Small flat add-on test for dorm bookings.", "FLAT", "50.00", "ALL", [], [2], [3]],
  ] as const;

  const ratePlans = await Promise.all(
    ratePlanSeeds.map(([name, description, amountType, amountValue, applicability, applicableDays]) =>
      upsertPropertyScoped(
        () => prisma.ratePlan.findFirst({ where: { propertyId: property.id, name } }),
        () =>
          prisma.ratePlan.create({
            data: {
              propertyId: property.id,
              name,
              description,
              amountType,
              amountValue,
              applicability,
              startDate: applicability === "DATE_RANGE" ? dateOnly("2026-08-20") : null,
              endDate: applicability === "DATE_RANGE" ? dateOnly("2026-08-31") : null,
              applicableDays,
              applicableMonths: [],
              applicableYears: [],
              isActive: true,
            },
          }),
        (id) =>
          prisma.ratePlan.update({
            where: { id },
            data: {
              description,
              amountType,
              amountValue,
              applicability,
              startDate: applicability === "DATE_RANGE" ? dateOnly("2026-08-20") : null,
              endDate: applicability === "DATE_RANGE" ? dateOnly("2026-08-31") : null,
              applicableDays,
              applicableMonths: [],
              applicableYears: [],
              isActive: true,
              deletedAt: null,
            },
          }),
      ),
    ),
  );

  await prisma.ratePlanRoomType.deleteMany({ where: { ratePlanId: { in: ratePlans.map((ratePlan) => ratePlan.id) } } });
  await prisma.ratePlanService.deleteMany({ where: { ratePlanId: { in: ratePlans.map((ratePlan) => ratePlan.id) } } });
  await prisma.ratePlanRoomType.createMany({
    data: ratePlanSeeds.flatMap((seed, ratePlanIndex) =>
      seed[6].map((roomTypeIndex) => ({
        ratePlanId: ratePlans[ratePlanIndex].id,
        roomTypeId: roomTypes[roomTypeIndex].id,
      })),
    ),
    skipDuplicates: true,
  });
  await prisma.ratePlanService.createMany({
    data: ratePlanSeeds.flatMap((seed, ratePlanIndex) =>
      seed[7].map((serviceIndex) => ({
        ratePlanId: ratePlans[ratePlanIndex].id,
        serviceId: services[serviceIndex].id,
      })),
    ),
    skipDuplicates: true,
  });

  await prisma.propertyPolicy.deleteMany({ where: { propertyId: property.id } });
  await prisma.propertyPolicy.createMany({
    data: [
      {
        propertyId: property.id,
        type: "CANCELLATION",
        title: "Flexible demo cancellation",
        content: "Cancel up to 24 hours before check-in with no charge. Later cancellations may charge one night.",
        isActive: true,
      },
      {
        propertyId: property.id,
        type: "HOUSE_RULE",
        title: "Demo house rules",
        content: "Photo ID is required. No smoking inside rooms. Quiet hours begin at 10 PM.",
        isActive: true,
      },
    ],
  });

  await Promise.all([
    prisma.roomAvailability.upsert({
      where: { roomId_date: { roomId: seededRooms[1].id, date: dateOnly("2026-08-22") } },
      update: { status: "UNAVAILABLE", priceOverride: "1350.00", bookingId: null },
      create: { roomId: seededRooms[1].id, date: dateOnly("2026-08-22"), status: "UNAVAILABLE", priceOverride: "1350.00" },
    }),
    prisma.roomAvailability.upsert({
      where: { roomId_date: { roomId: seededRooms[10].id, date: dateOnly("2026-08-23") } },
      update: { status: "AVAILABLE", priceOverride: "4200.00", bookingId: null },
      create: { roomId: seededRooms[10].id, date: dateOnly("2026-08-23"), status: "AVAILABLE", priceOverride: "4200.00" },
    }),
    prisma.serviceAvailability.upsert({
      where: { serviceId_date: { serviceId: services[1].id, date: dateOnly("2026-08-22") } },
      update: { isAvailable: false },
      create: { serviceId: services[1].id, date: dateOnly("2026-08-22"), isAvailable: false },
    }),
  ]);

  console.log("Seed sample data ready");
  console.log(`Owner login: ${ownerEmail}`);
  console.log(`Owner password: ${ownerPassword}`);
  console.log(`Property: ${property.name}`);
  console.log(`Created/updated ${roomTypes.length} room types, ${seededRooms.length} rooms, ${ratePlans.length} rate plans, ${services.length} services.`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
