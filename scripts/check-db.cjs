/**
 * Neon / Supabase どちらでも使える接続確認。
 * Next と同じ @next/env で .env を読み、Prisma が実際に繋がるかを見る。
 *
 * 使い方: npm run db:check
 *
 * 注意: @prisma/client を require する前に必ず loadEnvConfig すること。
 * 順序が逆だと Prisma が空の DATABASE_URL で初期化し、Supabase で Tenant or user not found 等になる。
 */
const path = require("path");
const root = path.join(__dirname, "..");
require("@next/env").loadEnvConfig(root);

const { PrismaClient } = require("@prisma/client");
const { spawnSync } = require("child_process");

function maskDbUrl(raw) {
  if (!raw || typeof raw !== "string") return "(未設定)";
  try {
    const u = new URL(raw);
    if (u.password) u.password = "***";
    return u.href;
  } catch {
    return "(URL として解釈できない)";
  }
}

async function main() {
  console.log("--- 環境変数（パスワードはマスク）---");
  console.log("DATABASE_URL:", maskDbUrl(process.env.DATABASE_URL));
  console.log("DIRECT_URL:  ", maskDbUrl(process.env.DIRECT_URL));

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("\n✖ DATABASE_URL が空です。.env をプロジェクト直下に置いてください。");
    process.exit(1);
  }
  if (!process.env.DIRECT_URL?.trim()) {
    console.error(
      "\n✖ DIRECT_URL が空です。prisma/schema.prisma の directUrl に必須です。"
    );
    process.exit(1);
  }

  console.log("\n--- Prisma クエリ（DATABASE_URL・実行時と同じ経路）---");
  let prisma = new PrismaClient({ log: ["error"] });
  let poolOk = false;
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    console.log("✔ SELECT 1 成功（アプリと同じ DATABASE_URL）");
    poolOk = true;
  } catch (e) {
    console.error("✖ DATABASE_URL で失敗:", (e && e.message) || e);
    await prisma.$disconnect();

    console.log("\n--- 切り分け: DIRECT_URL のみで SELECT 1（マイグレ用・直結 or Session 5432）---");
    const direct = process.env.DIRECT_URL;
    prisma = new PrismaClient({
      log: ["error"],
      datasources: { db: { url: direct } },
    });
    try {
      await prisma.$queryRaw`SELECT 1 AS ok`;
      console.log(
        "✔ DIRECT_URL では繋がる → Supabase の Transaction（6543）用 URI かユーザー名 postgres.<project-ref> が誤りです。Connect の Transaction を貼り直してください。"
      );
      console.log(
        "  暫定回避: schema の url を Session プール(5432)にし pgbouncer=true を外す構成は Prisma 推奨外なので、まず URI の再取得を推奨します。"
      );
    } catch (e2) {
      console.error("✖ DIRECT_URL でも失敗:", (e2 && e2.message) || e2);
      console.error(
        "\n  → パスワードの URL エンコード（!→%21）/ Supabase で DB パスワードリセット後に Connect の文字列を両方コピーし直し"
      );
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }

  if (!poolOk) {
    console.error(
      "\n※ アプリは DATABASE_URL（6543）必須のため、このままでは登録 API は失敗します。Transaction 用 URI を修正してください。"
    );
    process.exit(1);
  }

  console.log("\n--- DIRECT_URL で生 SQL（マイグレ用接続の切り分け）---");
  const dr = spawnSync(
    "npx",
    ["prisma", "db", "execute", "--stdin", `--url=${process.env.DIRECT_URL}`],
    {
      cwd: root,
      input: "SELECT 1",
      encoding: "utf-8",
    }
  );
  if (dr.status !== 0) {
    console.error(dr.stderr || dr.stdout);
    console.error(
      "\n✖ DIRECT_URL で SQL が実行できません。Vercel では db.*.supabase.co 直結より Session プール（5432）を試してください。"
    );
    process.exit(1);
  }
  console.log("✔ DIRECT_URL で SELECT 1 成功");

  console.log(
    "\n--- マイグレ履歴（未適用があっても接続は成功扱い。適用は npx prisma migrate deploy）---"
  );
  const st = spawnSync("npx", ["prisma", "migrate", "status"], {
    cwd: root,
    encoding: "utf-8",
    env: process.env,
  });
  process.stdout.write(st.stdout || "");
  process.stderr.write(st.stderr || "");

  console.log("\nすべて問題なければ、npm run dev を再起動してから登録を試してください。");
}

main();
