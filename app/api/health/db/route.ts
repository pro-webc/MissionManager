import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'User' AND c.relkind = 'r'
      ) AS "exists"
    `;
    const userTableExists = Boolean(rows[0]?.exists);

    if (!userTableExists) {
      return NextResponse.json(
        { ok: false, code: "NO_USER_TABLE" },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, code: "OK" });
  } catch (error) {
    console.error("GET /api/health/db:", error);
    return NextResponse.json(
      {
        ok: false,
        code: "DB_ERROR",
        ...(process.env.NODE_ENV === "development" && error instanceof Error
          ? { detail: error.message }
          : {}),
      },
      { status: 503 }
    );
  }
}
