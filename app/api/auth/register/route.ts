import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonError(
  error: string,
  code: string,
  status: number,
  extra?: Record<string, string | null | undefined>
) {
  return NextResponse.json({ error, code, ...extra }, { status });
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonError(
        "リクエスト本文が不正です（JSON が必要です）",
        "REGISTER_INVALID_JSON",
        400
      );
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name =
      typeof body.name === "string" ? body.name.trim() || null : null;

    if (!email) {
      return jsonError(
        "メールアドレスを入力してください",
        "REGISTER_EMAIL_EMPTY",
        400
      );
    }
    if (!isValidEmail(email)) {
      return jsonError(
        "有効なメールアドレスを入力してください",
        "REGISTER_EMAIL_INVALID",
        400
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return jsonError(
        `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください`,
        "REGISTER_PASSWORD_TOO_SHORT",
        400
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      return jsonError(
        "このメールアドレスはすでに登録されています",
        "REGISTER_EMAIL_ALREADY_EXISTS",
        400
      );
    }

    const passwordHash = await hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    return NextResponse.json({ ok: true, code: "REGISTER_OK" });
  } catch (error) {
    console.error("POST /api/auth/register:", error);

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return jsonError(
        "データベースに接続できません。",
        "REGISTER_DB_INIT",
        503
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaCode = error.code;
      if (error.code === "P2021") {
        return jsonError(
          "必要なテーブルがありません。",
          "REGISTER_DB_P2021",
          503,
          { prismaCode }
        );
      }
      if (error.code === "P2002") {
        return jsonError(
          "このメールアドレスはすでに登録されています",
          "REGISTER_EMAIL_ALREADY_EXISTS",
          400,
          { prismaCode }
        );
      }

      const connectionCodes = new Set([
        "P1000",
        "P1001",
        "P1002",
        "P1003",
        "P1008",
        "P1010",
        "P1011",
        "P1017",
      ]);
      if (connectionCodes.has(error.code)) {
        return jsonError(
          "データベースに接続できません。",
          `REGISTER_DB_${error.code}`,
          503,
          { prismaCode }
        );
      }

      return jsonError(
        "データベースエラーです。",
        `REGISTER_DB_${error.code}`,
        503,
        { prismaCode }
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return jsonError(
        "データが不正です。",
        "REGISTER_DB_PRISMA_VALIDATION",
        500
      );
    }

    const errName = error instanceof Error ? error.name : "unknown";
    return jsonError(
      "登録に失敗しました。",
      "REGISTER_INTERNAL_ERROR",
      500,
      { detail: errName }
    );
  }
}
