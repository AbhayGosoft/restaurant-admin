import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const superAdminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() ?? "admin@gmail.com";
const superAdminPassword = process.env.SUPERADMIN_PASSWORD ?? "123123";
const adminEmail = "manager@restaurant.local";
const adminPassword = "Manager@12345";

const CATEGORY_SEEDS = [
  { key: "pure_veg", label: "Pure Veg", sortOrder: 0 },
  { key: "north_indian", label: "North Indian", sortOrder: 1 },
  { key: "south_indian", label: "South Indian", sortOrder: 2 },
  { key: "fast_food", label: "Fast Food", sortOrder: 3 },
  { key: "cafe", label: "Cafe", sortOrder: 4 },
] as const;

const LUNCH_TIMES = ["11:00", "11:30", "12:00", "12:30", "13:00"];
const DINNER_TIMES = ["19:00", "19:30", "20:00", "20:30", "21:00"];

const main = async () => {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running the seed.");

  const superAdmin = await prisma.adminUser.upsert({
    where: { email: superAdminEmail },
    update: { name: "Super Admin", role: "SUPERADMIN", status: "ACTIVE", passwordHash: await bcrypt.hash(superAdminPassword, 12) },
    create: { name: "Super Admin", email: superAdminEmail, role: "SUPERADMIN", status: "ACTIVE", passwordHash: await bcrypt.hash(superAdminPassword, 12) },
  });

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { name: "Restaurant Manager", role: "ADMIN", status: "ACTIVE", passwordHash: await bcrypt.hash(adminPassword, 12) },
    create: { name: "Restaurant Manager", email: adminEmail, role: "ADMIN", status: "ACTIVE", passwordHash: await bcrypt.hash(adminPassword, 12) },
  });

  const categories = await Promise.all(
    CATEGORY_SEEDS.map((seed) =>
      prisma.restaurantCategory.upsert({
        where: { key: seed.key },
        update: { label: seed.label, sortOrder: seed.sortOrder, isActive: true },
        create: seed,
      }),
    ),
  );
  const categoryByKey = Object.fromEntries(categories.map((category) => [category.key, category]));

  const upsertRestaurant = async (data: {
    name: string;
    cuisineLabel: string;
    isPureVeg: boolean;
    categoryKeys: string[];
    city: string;
    addressLine: string;
    pincode: string;
    latitude: string;
    longitude: string;
    phone: string;
    priceForTwo: number;
    rating: string;
    ratingCount: number;
    offerText: string;
    offerSubText: string;
    about: string;
    banner: string;
  }) => {
    const existing = await prisma.restaurant.findFirst({ where: { name: data.name } });
    const base = {
      name: data.name,
      banner: data.banner,
      gallery: [data.banner],
      cuisineLabel: data.cuisineLabel,
      isPureVeg: data.isPureVeg,
      rating: data.rating,
      ratingCount: data.ratingCount,
      prepTimeMin: 20,
      prepTimeMax: 35,
      priceForTwo: data.priceForTwo,
      offerText: data.offerText,
      offerSubText: data.offerSubText,
      about: data.about,
      addressLine: data.addressLine,
      city: data.city,
      state: "Gujarat",
      country: "India",
      pincode: data.pincode,
      phone: data.phone,
      latitude: data.latitude,
      longitude: data.longitude,
      seatingCapacity: 40,
      maxPartySize: 12,
      status: "ACTIVE" as const,
    };

    const restaurant = existing
      ? await prisma.restaurant.update({ where: { id: existing.id }, data: base })
      : await prisma.restaurant.create({ data: base });

    await prisma.restaurantCategoryLink.deleteMany({ where: { restaurantId: restaurant.id } });
    await prisma.restaurantCategoryLink.createMany({
      data: data.categoryKeys.map((key) => ({ restaurantId: restaurant.id, categoryId: categoryByKey[key]!.id })),
      skipDuplicates: true,
    });

    await prisma.slotConfiguration.deleteMany({ where: { restaurantId: restaurant.id } });
    await prisma.slotConfiguration.createMany({
      data: [
        ...LUNCH_TIMES.map((time, index) => ({ restaurantId: restaurant.id, meal: "LUNCH" as const, time, sortOrder: index })),
        ...DINNER_TIMES.map((time, index) => ({ restaurantId: restaurant.id, meal: "DINNER" as const, time, sortOrder: index })),
      ],
    });

    return restaurant;
  };

  const restaurant1 = await upsertRestaurant({
    name: "Shree Shyam Restaurant",
    cuisineLabel: "Pure Veg • North Indian • Chinese",
    isPureVeg: true,
    categoryKeys: ["pure_veg", "north_indian"],
    city: "Ahmedabad",
    addressLine: "Mandir Road, Near Main Gate",
    pincode: "380001",
    latitude: "23.0225000",
    longitude: "72.5714000",
    phone: "9000001002",
    priceForTwo: 500,
    rating: "4.6",
    ratingCount: 1240,
    offerText: "50% OFF",
    offerSubText: "up to ₹100 on first order",
    about: "A cozy pure-veg family restaurant known for its North Indian thalis and Chinese starters.",
    banner: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80",
  });

  const restaurant2 = await upsertRestaurant({
    name: "Annapurna Pure Veg",
    cuisineLabel: "Pure Veg • South Indian • Gujarati",
    isPureVeg: true,
    categoryKeys: ["pure_veg", "south_indian"],
    city: "Ahmedabad",
    addressLine: "CG Road, Near Panchvati Circle",
    pincode: "380006",
    latitude: "23.0339000",
    longitude: "72.5619000",
    phone: "9000002003",
    priceForTwo: 400,
    rating: "4.4",
    ratingCount: 860,
    offerText: "20% OFF",
    offerSubText: "on orders above ₹299",
    about: "South Indian and Gujarati vegetarian favorites in a bright, family-friendly setting.",
    banner: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1400&q=80",
  });

  const restaurant3 = await upsertRestaurant({
    name: "Bites & Brews Cafe",
    cuisineLabel: "Cafe • Fast Food • Continental",
    isPureVeg: false,
    categoryKeys: ["cafe", "fast_food"],
    city: "Ahmedabad",
    addressLine: "SG Highway, Near Iskcon Cross Road",
    pincode: "380054",
    latitude: "23.0304000",
    longitude: "72.5066000",
    phone: "9000003004",
    priceForTwo: 450,
    rating: "4.3",
    ratingCount: 540,
    offerText: "Flat 15% OFF",
    offerSubText: "on all beverages",
    about: "A casual cafe serving all-day breakfast, burgers, and specialty coffee.",
    banner: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1400&q=80",
  });

  await prisma.adminRestaurant.deleteMany({ where: { adminId: admin.id } });
  await prisma.adminRestaurant.createMany({
    data: [
      { adminId: admin.id, restaurantId: restaurant1.id },
      { adminId: admin.id, restaurantId: restaurant3.id },
    ],
  });

  const seedMenu = async (
    restaurantId: string,
    categories: Array<{ name: string; items: Array<{ name: string; description: string; price: number; isVeg: boolean }> }>,
  ) => {
    await prisma.menuCategory.deleteMany({ where: { restaurantId } });
    for (const [index, category] of categories.entries()) {
      await prisma.menuCategory.create({
        data: {
          restaurantId,
          name: category.name,
          sortOrder: index,
          items: {
            create: category.items.map((item, itemIndex) => ({
              name: item.name,
              description: item.description,
              price: item.price,
              isVeg: item.isVeg,
              sortOrder: itemIndex,
              image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80",
            })),
          },
        },
      });
    }
  };

  await seedMenu(restaurant1.id, [
    {
      name: "Recommended",
      items: [
        { name: "Paneer Butter Masala", description: "Cottage cheese cubes in a rich tomato-butter gravy.", price: 220, isVeg: true },
        { name: "Dal Makhani", description: "Slow-cooked black lentils finished with cream.", price: 180, isVeg: true },
      ],
    },
    {
      name: "Starters",
      items: [
        { name: "Veg Manchurian", description: "Crispy vegetable dumplings tossed in a tangy sauce.", price: 190, isVeg: true },
        { name: "Paneer Tikka", description: "Chargrilled cottage cheese marinated in spiced yogurt.", price: 210, isVeg: true },
      ],
    },
    {
      name: "Breads",
      items: [
        { name: "Butter Naan", description: "Leavened bread brushed with butter.", price: 45, isVeg: true },
        { name: "Tandoori Roti", description: "Whole-wheat bread from the tandoor.", price: 30, isVeg: true },
      ],
    },
  ]);

  await seedMenu(restaurant2.id, [
    {
      name: "Recommended",
      items: [
        { name: "Masala Dosa", description: "Crisp rice crepe filled with spiced potato.", price: 140, isVeg: true },
        { name: "Gujarati Thali", description: "Unlimited thali with seasonal shaak, dal, and rotli.", price: 260, isVeg: true },
      ],
    },
    {
      name: "South Indian",
      items: [
        { name: "Idli Sambar", description: "Steamed rice cakes with lentil sambar.", price: 110, isVeg: true },
        { name: "Rava Uttapam", description: "Semolina pancake topped with onion and tomato.", price: 130, isVeg: true },
      ],
    },
  ]);

  await seedMenu(restaurant3.id, [
    {
      name: "Beverages",
      items: [
        { name: "Cold Coffee", description: "Chilled coffee blended with ice cream.", price: 150, isVeg: true },
        { name: "Cappuccino", description: "Espresso topped with steamed milk foam.", price: 130, isVeg: true },
      ],
    },
    {
      name: "Snacks",
      items: [
        { name: "French Fries", description: "Crispy salted potato fries.", price: 120, isVeg: true },
        { name: "Veg Burger", description: "Grilled veg patty with lettuce and cheese.", price: 160, isVeg: true },
        { name: "Chicken Burger", description: "Grilled chicken patty with lettuce and mayo.", price: 190, isVeg: false },
      ],
    },
  ]);

  // Dummy customer + payments + bookings so booking/notification APIs have data to return.
  const customer = await prisma.restaurantUser.upsert({
    where: { phone: "+919998887771" },
    update: { name: "Rahul Sharma", email: "rahul.sharma@example.com", centralUserId: 100001 },
    create: { phone: "+919998887771", name: "Rahul Sharma", email: "rahul.sharma@example.com", centralUserId: 100001 },
  });

  const upsertPayment = async (input: { orderId: string; paymentId: string; amount: number }) =>
    prisma.payment.upsert({
      where: { razorpayOrderId: input.orderId },
      update: {
        razorpayPaymentId: input.paymentId,
        razorpaySignature: `seed_signature_${input.orderId}`,
        amount: input.amount,
        status: "VERIFIED",
        restaurantUserId: customer.id,
      },
      create: {
        restaurantUserId: customer.id,
        razorpayOrderId: input.orderId,
        razorpayPaymentId: input.paymentId,
        razorpaySignature: `seed_signature_${input.orderId}`,
        amount: input.amount,
        status: "VERIFIED",
      },
    });

  const payment1 = await upsertPayment({ orderId: "order_SEED0001SSR", paymentId: "pay_SEED0001SSR", amount: 200 });
  const payment2 = await upsertPayment({ orderId: "order_SEED0002APV", paymentId: "pay_SEED0002APV", amount: 150 });
  const payment3 = await upsertPayment({ orderId: "order_SEED0003BBC", paymentId: "pay_SEED0003BBC", amount: 250 });

  const today = new Date();
  const inDays = (n: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + n);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  };

  const upsertBooking = async (input: {
    humanBookingId: string;
    restaurant: typeof restaurant1;
    paymentId: string;
    date: Date;
    time: string;
    people: number;
    tablePreference: "ANY" | "WINDOW" | "INDOOR" | "OUTDOOR";
    advancePaid: number;
    status: "UPCOMING" | "CANCELLED";
    cancellationReason?: "CHANGE_OF_PLANS" | "BOOKED_BY_MISTAKE" | "FOUND_BETTER_OPTION" | "RESTAURANT_NOT_RESPONDING" | "OTHER";
    refundEligible?: boolean;
    refundAmount?: number;
  }) => {
    const base = {
      restaurantId: input.restaurant.id,
      restaurantUserId: customer.id,
      restaurantNameSnapshot: input.restaurant.name,
      restaurantImageSnapshot: input.restaurant.banner,
      ratingSnapshot: input.restaurant.rating,
      cuisineLabelSnapshot: input.restaurant.cuisineLabel,
      date: input.date,
      time: input.time,
      people: input.people,
      tablePreference: input.tablePreference,
      fullName: customer.name,
      mobileNumber: customer.phone,
      email: customer.email,
      advancePaid: input.advancePaid,
      paymentId: input.paymentId,
      status: input.status,
      cancellationReason: input.cancellationReason,
      cancelledAt: input.status === "CANCELLED" ? new Date() : null,
      refundEligible: input.refundEligible,
      refundAmount: input.refundAmount,
    } as const;

    return prisma.restaurantBooking.upsert({
      where: { humanBookingId: input.humanBookingId },
      update: base,
      create: { humanBookingId: input.humanBookingId, ...base },
    });
  };

  const bookingUpcoming = await upsertBooking({
    humanBookingId: "#SSRSEED0001",
    restaurant: restaurant1,
    paymentId: payment1.id,
    date: inDays(3),
    time: "19:30",
    people: 4,
    tablePreference: "WINDOW",
    advancePaid: 200,
    status: "UPCOMING",
  });

  const bookingPast = await upsertBooking({
    humanBookingId: "#APVSEED0002",
    restaurant: restaurant2,
    paymentId: payment2.id,
    date: inDays(-5),
    time: "12:30",
    people: 2,
    tablePreference: "ANY",
    advancePaid: 150,
    status: "UPCOMING",
  });

  const bookingCancelled = await upsertBooking({
    humanBookingId: "#BBCSEED0003",
    restaurant: restaurant3,
    paymentId: payment3.id,
    date: inDays(5),
    time: "20:00",
    people: 3,
    tablePreference: "INDOOR",
    advancePaid: 250,
    status: "CANCELLED",
    cancellationReason: "CHANGE_OF_PLANS",
    refundEligible: true,
    refundAmount: 125,
  });

  await prisma.notification.deleteMany({ where: { restaurantUserId: customer.id } });
  await prisma.notification.createMany({
    data: [
      {
        restaurantUserId: customer.id,
        type: "BOOKING_CONFIRMED",
        bookingId: bookingUpcoming.id,
        title: "Booking confirmed",
        body: `Your table at ${restaurant1.name} is confirmed.`,
      },
      {
        restaurantUserId: customer.id,
        type: "BOOKING_CONFIRMED",
        bookingId: bookingPast.id,
        title: "Booking confirmed",
        body: `Your table at ${restaurant2.name} is confirmed.`,
      },
      {
        restaurantUserId: customer.id,
        type: "BOOKING_CANCELLED",
        bookingId: bookingCancelled.id,
        title: "Booking cancelled",
        body: `Your booking at ${restaurant3.name} has been cancelled.`,
      },
    ],
  });

  console.log("Seed complete.");
  console.log(`SuperAdmin login: ${superAdminEmail} / ${superAdminPassword}`);
  console.log(`Admin login: ${adminEmail} / ${adminPassword} (manages "${restaurant1.name}", "${restaurant3.name}")`);
  console.log(`Restaurants: ${restaurant1.name}, ${restaurant2.name}, ${restaurant3.name}`);
  console.log(`Dummy customer: ${customer.name} (${customer.phone}) with 3 bookings (upcoming/past/cancelled)`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
