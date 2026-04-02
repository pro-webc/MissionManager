const path = require("path");
const root = path.join(__dirname, "..");
require("@next/env").loadEnvConfig(root);

const { PrismaClient } = require("@prisma/client");
const { spawnSync } = require("child_process");

function mask(raw) {
  if (!raw) return "(empty)";
  try {
    const u = new URL(raw);
    if (u.password) u.password = "***";
    return u.href;
  } catch {
    return "(invalid)";
  }
}

async function main() {
  const du = process.env.DIRECT_URL?.trim();
  const ru = process.env.DATABASE_URL?.trim();
  if (!ru) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  if (!du) {
    console.error("DIRECT_URL missing");
    process.exit(1);
  }
  console.log("DATABASE_URL", mask(ru));
  console.log("DIRECT_URL ", mask(du));

  const prisma = new PrismaClient({ log: ["error"] });
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.error("DATABASE_URL:", e.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
  console.log("DATABASE_URL: ok");

  const ex = spawnSync(
    "npx",
    ["prisma", "db", "execute", "--stdin", `--url=${du}`],
    { cwd: root, input: "SELECT 1", encoding: "utf-8" }
  );
  if (ex.status !== 0) {
    console.error("DIRECT_URL:", ex.stderr || ex.stdout || "failed");
    process.exit(1);
  }
  console.log("DIRECT_URL: ok");

  spawnSync("npx", ["prisma", "migrate", "status"], {
    cwd: root,
    encoding: "utf-8",
    stdio: "inherit",
    env: process.env,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
