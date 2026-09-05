import { PrismaClient } from "@prisma/client";

// NOTE: host-control is in-memory + localStorage. The prisma client is created
// but never queried by the host-control code paths. It exists only so
// `import { db } from "@/lib/db"` does not break tree-shaking in CI builds.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
