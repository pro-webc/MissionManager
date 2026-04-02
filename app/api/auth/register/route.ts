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
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "リクエスト本文が不正です（JSON が必要です）" },
        { status: 400 }
      );
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name =
      typeof body.name === "string" ? body.name.trim() || null : null;

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
        name,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/register:", error);

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        {
          error:
            "データベースに接続できません（初期化エラー）。Vercel の DATABASE_URL / DIRECT_URL と Supabase の Connect 文字列を照合し、パスワードに記号がある場合は URL エンコードしてください。",
          prismaCode: "INIT",
        },
        { status: 503 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2021") {
        return NextResponse.json(
          {
            error:
              "データベースにユーザー用のテーブルがありません。デプロイ時にマイグレーション（prisma migrate deploy）が実行されているか、Vercel の DATABASE_URL / DIRECT_URL を確認してください。",
            prismaCode: error.code,
          },
          { status: 503 }
        );
      }
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "このメールアドレスはすでに登録されています", prismaCode: error.code },
          { status: 400 }
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
        return NextResponse.json(
          {
            error:
              "データベースに接続できないか、タイムアウトしました。DATABASE_URL（6543 + pgbouncer=true）、IPv6 不可なら Session プールの DIRECT_URL（5432）を使う、接続数は connection_limit=1 を試してください。",
            prismaCode: error.code,
          },
          { status: 503 }
        );
      }

      if (error.code === "P2010") {
        const metaMsg =
          typeof error.meta?.message === "string" ? error.meta.message : error.message;
        if (/does not exist/i.test(metaMsg) || /relation/i.test(metaMsg)) {
          return NextResponse.json(
            {
              error:
                "DBのテーブルが見つかりません。本番でマイグレーションが適用されているか、接続先データベースが正しいか確認してください。",
              prismaCode: error.code,
            },
            { status: 503 }
          );
        }
      }

      return NextResponse.json(
        {
          error: `データベース処理に失敗しました（Prisma ${error.code}）。Vercel の Function ログの直前のスタックを確認してください。`,
          prismaCode: error.code,
        },
        { status: 503 }
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json(
        { error: "サーバー側のデータ形式エラーです。管理者に連絡してください。", prismaCode: "VALIDATION" },
        { status: 500 }
      );
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

    return NextResponse.json(
      {
        error: `登録に失敗しました（${error instanceof Error ? error.name : "unknown"}）。Vercel のログを確認してください。`,
        prismaCode: null,
      },
      { status: 500 }
    );
  }
}
