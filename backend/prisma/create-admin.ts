import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const main = async () => {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running this script.");
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME ?? "Super Admin";
  if (!email || !password) throw new Error("Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD before running this script.");

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { name, passwordHash, role: "SUPERADMIN", status: "ACTIVE" },
    create: { name, email, passwordHash, role: "SUPERADMIN", status: "ACTIVE" },
  });

  console.log(`SuperAdmin ready: ${admin.email}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
