import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

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
