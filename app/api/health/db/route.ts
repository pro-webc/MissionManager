import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 本番の DB 接続と User テーブル有無を確認する（認証不要）。
 * ブラウザで https://<本番>/api/health/db を開いて切り分けに使う。
 */
export async function GET() {
  const isDev = process.env.NODE_ENV === "development";

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
        {
          ok: false,
          database: "connected",
          userTable: false,
          hint:
            "DB には繋がっていますが public.User がありません。Vercel ビルドで prisma migrate deploy が失敗していないか、別プロジェクトの DB に繋いでいないか確認してください。",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      database: "connected",
      userTable: true,
    });
  } catch (error) {
    console.error("GET /api/health/db:", error);
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        userTable: null,
        hint:
          "DATABASE_URL が Vercel に無い・誤り、または直結 db.*.supabase.co が IPv6 で届かない等の可能性があります。DIRECT_URL は Session プール（pooler の 5432）を推奨します。",
        ...(isDev && error instanceof Error
          ? { detail: error.message }
          : {}),
      },
      { status: 503 }
    );
  }
}
