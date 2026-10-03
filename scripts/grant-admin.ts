/**
 * Grants the ADMIN role: npm run admin:grant -- someone@example.com
 * Runs against DATABASE_URL from .env.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run admin:grant -- <email>");
    process.exit(1);
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const user = await db.user.update({ where: { email }, data: { role: "ADMIN" } }).catch(() => null);
  console.log(user ? `${email} is now an admin.` : `No user with email ${email}.`);
  await db.$disconnect();
}

void main();
