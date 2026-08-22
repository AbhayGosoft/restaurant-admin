import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const main = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script.");
  }

  // Drops the stale blank-email admin row left over from the old seed script
  // (it ran before ADMIN_EMAIL had a real value, so it upserted email: "").
  await prisma.user.deleteMany({ where: { role: "ADMIN", email: "" } });

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      mustResetPassword: false,
      setupCompleted: true,
      currentStep: "COMPLETED",
    },
    create: {
      name: "Admin",
      email,
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      mustResetPassword: false,
      setupCompleted: true,
      currentStep: "COMPLETED",
    },
  });

  console.log(`Admin ready: ${admin.email}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
