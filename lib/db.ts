import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

// Prisma より前に .env を process.env へ載せる（API ルートの評価順で env が空 → REGISTER_DB_INIT になるのを防ぐ）
loadEnvConfig(process.cwd());

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// Next.js のサーバーレスでも同一インスタンス内で接続を使い回す（公式推奨）
globalForPrisma.prisma = prisma;
