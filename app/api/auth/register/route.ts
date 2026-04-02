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
      const onVercel = Boolean(process.env.VERCEL);
      const localHint = [
        "データベース接続の初期化に失敗しました（ローカル開発中）。",
        "① プロジェクト直下の .env に DATABASE_URL と DIRECT_URL があるか確認する。",
        "② DB パスワードに ! などがある場合は URI 内で %21 などにエンコードする。",
        "③ .env を直したあとは、開発サーバーを一度止めてから npm run dev で**再起動**する（起動中の Node は古い環境変数のままのことがあります）。",
        "④ ターミナルで npx prisma db execute --stdin <<< \"SELECT 1\" が成功するか試す。",
        "⑤ ブラウザで /api/health/db を開いて接続状況を確認する。",
      ].join(" ");
      const vercelHint = [
        "データベース接続の初期化に失敗しました（本番・Vercel 上）。",
        "① Vercel → Settings → Environment Variables で DATABASE_URL・DIRECT_URL・AUTH_SECRET を「Production」に設定しているか。",
        "② 値の先頭・末尾にダブルクォートを付けない。",
        "③ パスワードの記号は URL エンコード（! → %21 など）。",
        "④ DIRECT_URL は Supabase Connect の Session（pooler :5432）推奨。",
        "⑤ 保存後に Redeploy。",
      ].join(" ");
      const isNextDev = process.env.NODE_ENV === "development";
      const message = onVercel
        ? vercelHint
        : isNextDev
          ? localHint
          : [
              "データベース接続の初期化に失敗しました。",
              ".env の DATABASE_URL / DIRECT_URL、パスワードの URL エンコード（!→%21 等）を確認し、変更後はサーバー再起動または Vercel の Redeploy を行ってください。",
            ].join(" ");
      return jsonError(message, "REGISTER_DB_INIT", 503);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaCode = error.code;
      if (error.code === "P2021") {
        return jsonError(
          "データベースにユーザー用のテーブルがありません。デプロイ時にマイグレーション（prisma migrate deploy）が実行されているか、Vercel の DATABASE_URL / DIRECT_URL を確認してください。",
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
          "データベースに接続できないか、タイムアウトしました。DATABASE_URL（6543 + pgbouncer=true）、IPv6 不可なら Session プールの DIRECT_URL（5432）を使う、接続数は connection_limit=1 を試してください。",
          `REGISTER_DB_${error.code}`,
          503,
          { prismaCode }
        );
      }

      if (error.code === "P2010") {
        const metaMsg =
          typeof error.meta?.message === "string" ? error.meta.message : error.message;
        if (/does not exist/i.test(metaMsg) || /relation/i.test(metaMsg)) {
          return jsonError(
            "DBのテーブルが見つかりません。本番でマイグレーションが適用されているか、接続先データベースが正しいか確認してください。",
            "REGISTER_DB_P2010_TABLE",
            503,
            { prismaCode }
          );
        }
      }

      return jsonError(
        `データベース処理に失敗しました（Prisma ${error.code}）。Vercel の Function ログの直前のスタックを確認してください。`,
        `REGISTER_DB_${error.code}`,
        503,
        { prismaCode }
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      return jsonError(
        "サーバー側のデータ形式エラーです。管理者に連絡してください。",
        "REGISTER_DB_PRISMA_VALIDATION",
        500
      );
    }

    const msg = error instanceof Error ? error.message : String(error);

    if (/prepared statement/i.test(msg)) {
      return jsonError(
        "DB接続（プール）の設定が不十分です。Vercel の DATABASE_URL 末尾に ?pgbouncer=true を付けたうえで、&connection_limit=1 を追加してください（ローカルの .env と一致させる）。",
        "REGISTER_DB_POOL_PREPARED_STATEMENT",
        503
      );
    }

    if (
      /does not exist/i.test(msg) &&
      (/relation/i.test(msg) || /table/i.test(msg) || /\"User\"/i.test(msg))
    ) {
      return jsonError(
        "DBに User テーブルがありません。Vercel のデプロイログで prisma migrate deploy が成功しているか確認し、DATABASE_URL / DIRECT_URL を Supabase の Connect 画面の値に合わせてください。",
        "REGISTER_DB_USER_TABLE_MISSING",
        503
      );
    }

    if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      console.error("POST /api/auth/register (unknown):", error.message);
    }

    const errName = error instanceof Error ? error.name : "unknown";
    return jsonError(
      `登録に失敗しました（${errName}）。Vercel のログを確認してください。`,
      "REGISTER_INTERNAL_ERROR",
      500,
      { detail: errName }
    );
  }
}
