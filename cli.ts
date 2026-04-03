#!/usr/bin/env npx tsx
/**
 * MissionManagerWeb CLI
 *
 * Usage:
 *   npx tsx cli.ts login
 *   npx tsx cli.ts departments
 *   npx tsx cli.ts projects <departmentId>
 *   npx tsx cli.ts detail <projectId>
 *   npx tsx cli.ts tasks [--all]
 *   npx tsx cli.ts overdue
 *   npx tsx cli.ts search <keyword>
 *   npx tsx cli.ts logout
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// ---------- config ----------

const SESSION_FILE = path.join(
  process.env.HOME ?? "/tmp",
  ".mmweb-session.json"
);
const DEFAULT_BASE = "http://localhost:3000";

interface Session {
  baseUrl: string;
  cookies: string;
}

function loadSession(): Session | null {
  try {
    const raw = fs.readFileSync(SESSION_FILE, "utf-8");
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function saveSession(session: Session) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session), { mode: 0o600 });
}

function clearSession() {
  try {
    fs.unlinkSync(SESSION_FILE);
  } catch {}
}

// ---------- http helpers ----------

async function fetchRaw(
  url: string,
  init?: RequestInit
): Promise<{ status: number; headers: Headers; body: string }> {
  const res = await fetch(url, init);
  const body = await res.text();
  return { status: res.status, headers: res.headers, body };
}

function extractSetCookies(headers: Headers): string[] {
  const raw = headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]);
}

function mergeCookies(existing: string, incoming: string[]): string {
  const map = new Map<string, string>();
  for (const c of existing.split("; ").filter(Boolean)) {
    const [k, ...v] = c.split("=");
    map.set(k, v.join("="));
  }
  for (const c of incoming) {
    const [k, ...v] = c.split("=");
    map.set(k, v.join("="));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function api(
  session: Session,
  path: string,
  init?: RequestInit
): Promise<unknown> {
  const res = await fetchRaw(`${session.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Cookie: session.cookies,
    },
    redirect: "manual",
  });

  const newCookies = extractSetCookies(res.headers);
  if (newCookies.length > 0) {
    session.cookies = mergeCookies(session.cookies, newCookies);
    saveSession(session);
  }

  if (res.status === 401) {
    console.error("認証エラー: 再度 login してください");
    process.exit(1);
  }

  try {
    return JSON.parse(res.body);
  } catch {
    console.error(`API エラー (HTTP ${res.status})`);
    process.exit(1);
  }
}

// ---------- prompt ----------

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function promptPassword(question: string): Promise<string> {
  process.stderr.write(question);
  if (!process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin });
    return new Promise((resolve) => {
      rl.once("line", (line) => {
        rl.close();
        resolve(line);
      });
    });
  }
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf-8");
    let pw = "";
    const onData = (ch: string) => {
      if (ch === "\n" || ch === "\r" || ch === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stderr.write("\n");
        resolve(pw);
      } else if (ch === "\u0003") {
        process.exit(0);
      } else if (ch === "\u007f" || ch === "\b") {
        pw = pw.slice(0, -1);
      } else {
        pw += ch;
      }
    };
    stdin.on("data", onData);
  });
}

// ---------- login ----------

async function doLogin(baseUrl: string) {
  const email = await prompt("Email: ");
  const password = await promptPassword("Password: ");

  // 1. get CSRF token
  const csrfRes = await fetchRaw(`${baseUrl}/api/auth/csrf`);
  const csrfCookies = extractSetCookies(csrfRes.headers);
  const { csrfToken } = JSON.parse(csrfRes.body) as { csrfToken: string };

  // 2. signin
  const cookieHeader = csrfCookies.join("; ");
  const body = new URLSearchParams({
    email: email.trim().toLowerCase(),
    password,
    csrfToken,
    json: "true",
  });

  const signInRes = await fetchRaw(
    `${baseUrl}/api/auth/callback/credentials`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader,
      },
      body: body.toString(),
      redirect: "manual",
    }
  );

  const allCookies = mergeCookies(
    cookieHeader,
    extractSetCookies(signInRes.headers)
  );

  if (signInRes.status >= 400) {
    console.error("ログイン失敗: メールアドレスまたはパスワードが正しくありません");
    process.exit(1);
  }

  // 3. verify session
  const sessionRes = await fetchRaw(`${baseUrl}/api/auth/session`, {
    headers: { Cookie: allCookies },
  });
  const sessionData = JSON.parse(sessionRes.body) as {
    user?: { email?: string };
  };

  const finalCookies = mergeCookies(
    allCookies,
    extractSetCookies(sessionRes.headers)
  );

  if (!sessionData.user?.email) {
    console.error("ログイン失敗: セッションが取得できませんでした");
    process.exit(1);
  }

  saveSession({ baseUrl, cookies: finalCookies });
  console.log(`ログイン成功: ${sessionData.user.email}`);
}

// ---------- formatting ----------

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  return d.slice(0, 10);
}

// ---------- commands ----------

async function cmdDepartments(session: Session) {
  const data = (await api(session, "/api/departments")) as {
    departments: { id: string; name: string; order: number }[];
  };
  if (data.departments.length === 0) {
    console.log("部門がありません");
    return;
  }
  for (const d of data.departments) {
    console.log(`${d.id}  ${d.name}`);
  }
}

async function cmdProjects(session: Session, departmentId: string) {
  const data = (await api(
    session,
    `/api/projects?departmentId=${departmentId}`
  )) as {
    projects: {
      id: string;
      name: string;
      summary?: string | null;
      dueDate?: string | null;
      assignee?: { name: string } | null;
      mainTasks?: { subTasks?: { done: boolean }[] }[];
    }[];
  };
  if (data.projects.length === 0) {
    console.log("プロジェクトがありません");
    return;
  }
  for (const p of data.projects) {
    const tasks = p.mainTasks ?? [];
    const incomplete = tasks.filter((m) => {
      const subs = m.subTasks ?? [];
      const done = subs.filter((s) => s.done).length;
      return subs.length === 0 || done < subs.length;
    }).length;
    const parts = [p.id, p.name];
    if (p.dueDate) parts.push(`期限:${fmtDate(p.dueDate)}`);
    if (p.assignee) parts.push(`担当:${p.assignee.name}`);
    if (incomplete > 0) parts.push(`未完了:${incomplete}`);
    console.log(parts.join("  "));
  }
}

async function cmdDetail(session: Session, projectId: string) {
  const data = (await api(session, `/api/projects?departmentId=_`)) as {
    projects: unknown[];
  };
  // detail needs a different approach - get from projects list
  // Actually let's fetch all and find, or build per-project endpoint
  // For now, use the projects list with all mainTasks included
  const allDepts = (await api(session, "/api/departments")) as {
    departments: { id: string }[];
  };
  for (const dept of allDepts.departments) {
    const res = (await api(
      session,
      `/api/projects?departmentId=${dept.id}`
    )) as {
      projects: {
        id: string;
        name: string;
        summary?: string | null;
        dueDate?: string | null;
        assignee?: { name: string } | null;
        mainTasks?: {
          id: string;
          name: string;
          summary?: string | null;
          dueDate?: string | null;
          completedAt?: string | null;
          assignee?: { name: string } | null;
          subTasks?: {
            name: string;
            done: boolean;
            dueDate?: string | null;
          }[];
        }[];
      }[];
    };
    const project = res.projects.find((p) => p.id === projectId);
    if (!project) continue;

    console.log(`# ${project.name}`);
    if (project.summary) console.log(`  概要: ${project.summary}`);
    if (project.dueDate) console.log(`  期限: ${fmtDate(project.dueDate)}`);
    if (project.assignee) console.log(`  担当: ${project.assignee.name}`);
    console.log();

    for (const mt of project.mainTasks ?? []) {
      const subs = mt.subTasks ?? [];
      const done = subs.filter((s) => s.done).length;
      const status = subs.length > 0 ? `${done}/${subs.length}` : "0/0";
      const parts = [`  [${status}] ${mt.name}`];
      if (mt.dueDate) parts.push(`期限:${fmtDate(mt.dueDate)}`);
      if (mt.assignee) parts.push(`担当:${mt.assignee.name}`);
      console.log(parts.join("  "));

      for (const st of subs) {
        const mark = st.done ? "x" : " ";
        const due = st.dueDate ? `  期限:${fmtDate(st.dueDate)}` : "";
        console.log(`    [${mark}] ${st.name}${due}`);
      }
    }
    return;
  }
  console.error("プロジェクトが見つかりません");
}

async function cmdTasks(session: Session, includeAll: boolean) {
  const depts = (await api(session, "/api/departments")) as {
    departments: { id: string; name: string }[];
  };
  let found = false;
  for (const dept of depts.departments) {
    const res = (await api(
      session,
      `/api/projects?departmentId=${dept.id}`
    )) as {
      projects: {
        name: string;
        mainTasks?: {
          name: string;
          dueDate?: string | null;
          assignee?: { name: string } | null;
          subTasks?: { name: string; done: boolean; dueDate?: string | null }[];
        }[];
      }[];
    };
    for (const proj of res.projects) {
      for (const mt of proj.mainTasks ?? []) {
        const subs = mt.subTasks ?? [];
        const done = subs.filter((s) => s.done).length;
        const isComplete = subs.length > 0 && done === subs.length;
        if (!includeAll && isComplete) continue;
        found = true;
        const parts = [
          `[${isComplete ? "完了" : `${done}/${subs.length}`}]`,
          `${dept.name} > ${proj.name} > ${mt.name}`,
        ];
        if (mt.dueDate) parts.push(`期限:${fmtDate(mt.dueDate)}`);
        if (mt.assignee) parts.push(`担当:${mt.assignee.name}`);
        console.log(parts.join("  "));
        for (const st of subs) {
          if (!includeAll && st.done) continue;
          const mark = st.done ? "x" : " ";
          const due = st.dueDate ? `  期限:${fmtDate(st.dueDate)}` : "";
          console.log(`  [${mark}] ${st.name}${due}`);
        }
      }
    }
  }
  if (!found) console.log("タスクがありません");
}

async function cmdOverdue(session: Session) {
  const now = new Date();
  const depts = (await api(session, "/api/departments")) as {
    departments: { id: string; name: string }[];
  };
  let found = false;
  for (const dept of depts.departments) {
    const res = (await api(
      session,
      `/api/projects?departmentId=${dept.id}`
    )) as {
      projects: {
        name: string;
        dueDate?: string | null;
        mainTasks?: {
          name: string;
          dueDate?: string | null;
          completedAt?: string | null;
          assignee?: { name: string } | null;
          subTasks?: {
            name: string;
            done: boolean;
            dueDate?: string | null;
          }[];
        }[];
      }[];
    };
    for (const proj of res.projects) {
      for (const mt of proj.mainTasks ?? []) {
        if (mt.dueDate && new Date(mt.dueDate) < now && !mt.completedAt) {
          found = true;
          const subs = mt.subTasks ?? [];
          const done = subs.filter((s) => s.done).length;
          console.log(
            `[メインタスク] ${dept.name} > ${proj.name} > ${mt.name}  期限:${fmtDate(mt.dueDate)}  進捗:${done}/${subs.length}` +
              (mt.assignee ? `  担当:${mt.assignee.name}` : "")
          );
        }
        for (const st of mt.subTasks ?? []) {
          if (st.dueDate && new Date(st.dueDate) < now && !st.done) {
            found = true;
            console.log(
              `[サブタスク]   ${dept.name} > ${proj.name} > ${mt.name} > ${st.name}  期限:${fmtDate(st.dueDate)}`
            );
          }
        }
      }
    }
  }
  if (!found) console.log("期限切れタスクなし");
}

async function cmdSearch(session: Session, keyword: string) {
  const depts = (await api(session, "/api/departments")) as {
    departments: { id: string; name: string }[];
  };
  let found = false;
  const kw = keyword.toLowerCase();
  for (const dept of depts.departments) {
    const res = (await api(
      session,
      `/api/projects?departmentId=${dept.id}`
    )) as {
      projects: {
        name: string;
        mainTasks?: {
          name: string;
          summary?: string | null;
          assignee?: { name: string } | null;
          subTasks?: { name: string; summary?: string | null; done: boolean }[];
        }[];
      }[];
    };
    for (const proj of res.projects) {
      for (const mt of proj.mainTasks ?? []) {
        const mtMatch =
          mt.name.toLowerCase().includes(kw) ||
          (mt.summary ?? "").toLowerCase().includes(kw);
        if (mtMatch) {
          found = true;
          console.log(
            `[メインタスク] ${dept.name} > ${proj.name} > ${mt.name}`
          );
        }
        for (const st of mt.subTasks ?? []) {
          const stMatch =
            st.name.toLowerCase().includes(kw) ||
            (st.summary ?? "").toLowerCase().includes(kw);
          if (stMatch) {
            found = true;
            console.log(
              `[サブタスク]   ${dept.name} > ${proj.name} > ${mt.name} > ${st.name}  ${st.done ? "[完了]" : "[未完了]"}`
            );
          }
        }
      }
    }
  }
  if (!found) console.log("該当なし");
}

// ---------- main ----------

const HELP = `MissionManagerWeb CLI

使い方:
  npx tsx cli.ts login [URL]         ログイン (デフォルト: ${DEFAULT_BASE})
  npx tsx cli.ts logout              ログアウト
  npx tsx cli.ts departments         部門一覧
  npx tsx cli.ts projects <部門ID>   プロジェクト一覧
  npx tsx cli.ts detail <PJ-ID>      プロジェクト詳細
  npx tsx cli.ts tasks [--all]       全タスク一覧 (--all: 完了含む)
  npx tsx cli.ts overdue             期限切れタスク
  npx tsx cli.ts search <キーワード> タスク検索
`;

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    return;
  }

  if (cmd === "login") {
    const baseUrl = args[1] ?? DEFAULT_BASE;
    await doLogin(baseUrl);
    return;
  }

  if (cmd === "logout") {
    clearSession();
    console.log("ログアウトしました");
    return;
  }

  const session = loadSession();
  if (!session) {
    console.error("未ログインです。先に login してください:\n  npx tsx cli.ts login");
    process.exit(1);
  }

  switch (cmd) {
    case "departments":
    case "dept":
      await cmdDepartments(session);
      break;
    case "projects":
    case "pj":
      if (!args[1]) {
        console.error("部門IDを指定してください");
        process.exit(1);
      }
      await cmdProjects(session, args[1]);
      break;
    case "detail":
      if (!args[1]) {
        console.error("プロジェクトIDを指定してください");
        process.exit(1);
      }
      await cmdDetail(session, args[1]);
      break;
    case "tasks":
      await cmdTasks(session, args.includes("--all"));
      break;
    case "overdue":
      await cmdOverdue(session);
      break;
    case "search":
      if (!args[1]) {
        console.error("キーワードを指定してください");
        process.exit(1);
      }
      await cmdSearch(session, args.slice(1).join(" "));
      break;
    default:
      console.error(`不明なコマンド: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("エラー:", err.message ?? err);
  process.exit(1);
});
