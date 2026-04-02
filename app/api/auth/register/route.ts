import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスを入力してください" },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "有効なメールアドレスを入力してください" },
        { status: 400 }
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください` },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      return NextResponse.json(
        { error: "このメールアドレスはすでに登録されています" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: body.name?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/register:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2021") {
        return NextResponse.json(
          {
            error:
              "データベースにユーザー用のテーブルがありません。デプロイ時にマイグレーション（prisma migrate deploy）が実行されているか、Vercel の DATABASE_URL / DIRECT_URL を確認してください。",
          },
          { status: 503 }
        );
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "このメールアドレスはすでに登録されています" },
          { status: 400 }
        );
      }
    }

    const msg = error instanceof Error ? error.message : String(error);

    if (/prepared statement/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "DB接続（プール）の設定が不十分です。Vercel の DATABASE_URL 末尾に ?pgbouncer=true を付けたうえで、&connection_limit=1 を追加してください（ローカルの .env と一致させる）。",
        },
        { status: 503 }
      );
    }

    if (
      /does not exist/i.test(msg) &&
      (/relation/i.test(msg) || /table/i.test(msg) || /\"User\"/i.test(msg))
    ) {
      return NextResponse.json(
        {
          error:
            "DBに User テーブルがありません。Vercel のデプロイログで prisma migrate deploy が成功しているか確認し、DATABASE_URL / DIRECT_URL を Supabase の Connect 画面の値に合わせてください。",
        },
        { status: 503 }
      );
    }

    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      console.error("POST /api/auth/register (unknown):", error.message);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2010"
    ) {
      const metaMsg = typeof error.meta?.message === "string" ? error.meta.message : msg;
      if (/does not exist/i.test(metaMsg) || /relation/i.test(metaMsg)) {
        return NextResponse.json(
          {
            error:
              "DBのテーブルが見つかりません。本番でマイグレーションが適用されているか、接続先データベースが正しいか確認してください。",
          },
          { status: 503 }
        );
      }
    }
    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P1001" || error.code === "P1017"))
    ) {
      return NextResponse.json(
        {
          error:
            "データベースに接続できません。DATABASE_URL（および Supabase 利用時は DIRECT_URL）が本番用に正しく設定されているか確認してください。",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "登録に失敗しました" },
      { status: 500 }
    );
  }
}
