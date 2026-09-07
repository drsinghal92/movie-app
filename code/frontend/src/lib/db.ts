import { PrismaClient } from "@prisma/client";

// Singleton Prisma client, avoids exhausting connections on Next.js hot
// reload in dev. Real query modules import this rather than instantiating
// their own client.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
