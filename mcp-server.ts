import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const server = new McpServer({
  name: "mission-manager",
  version: "1.0.0",
});

// ---------- Resources ----------

server.resource("schema", "schema://prisma", async () => ({
  contents: [
    {
      uri: "schema://prisma",
      mimeType: "text/plain",
      text: `データ構造:
- User: ユーザー (email, name)
- Department: 部門 (name, order)
- Project: プロジェクト (name, summary, dueDate, assignee, order) ※部門に属する
- MainTask: メインタスク (name, summary, dueDate, assignee, completedAt, order) ※プロジェクトに属する
- SubTask: サブタスク (name, summary, done, dueDate, completedAt, order) ※メインタスクに属する
- Assignee: 担当者 (name)

階層: Department > Project > MainTask > SubTask`,
    },
  ],
}));

// ---------- Tools ----------

server.tool(
  "list_departments",
  "部門の一覧を取得",
  { user_email: z.string().describe("ユーザーのメールアドレス") },
  async ({ user_email }) => {
    const user = await prisma.user.findUnique({ where: { email: user_email } });
    if (!user) return { content: [{ type: "text" as const, text: "ユーザーが見つかりません" }] };
    const departments = await prisma.department.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(departments, null, 2) }] };
  }
);

server.tool(
  "list_projects",
  "指定部門のプロジェクト一覧を取得",
  {
    user_email: z.string().describe("ユーザーのメールアドレス"),
    department_id: z.string().describe("部門ID"),
  },
  async ({ user_email, department_id }) => {
    const user = await prisma.user.findUnique({ where: { email: user_email } });
    if (!user) return { content: [{ type: "text" as const, text: "ユーザーが見つかりません" }] };
    const projects = await prisma.project.findMany({
      where: { userId: user.id, departmentId: department_id },
      orderBy: { order: "asc" },
      include: { assignee: true },
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }] };
  }
);

server.tool(
  "get_project_detail",
  "プロジェクトの詳細（メインタスク・サブタスク含む）を取得",
  {
    project_id: z.string().describe("プロジェクトID"),
  },
  async ({ project_id }) => {
    const project = await prisma.project.findUnique({
      where: { id: project_id },
      include: {
        assignee: true,
        mainTasks: {
          orderBy: { order: "asc" },
          include: {
            assignee: true,
            subTasks: { orderBy: { order: "asc" } },
          },
        },
      },
    });
    if (!project) return { content: [{ type: "text" as const, text: "プロジェクトが見つかりません" }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }] };
  }
);

server.tool(
  "list_all_tasks",
  "ユーザーの全タスクをフラットに一覧表示（進捗確認用）",
  {
    user_email: z.string().describe("ユーザーのメールアドレス"),
    include_done: z.boolean().optional().describe("完了済みも含めるか（デフォルト: false）"),
  },
  async ({ user_email, include_done }) => {
    const user = await prisma.user.findUnique({ where: { email: user_email } });
    if (!user) return { content: [{ type: "text" as const, text: "ユーザーが見つかりません" }] };
    const departments = await prisma.department.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      include: {
        projects: {
          orderBy: { order: "asc" },
          include: {
            assignee: true,
            mainTasks: {
              orderBy: { order: "asc" },
              include: {
                assignee: true,
                subTasks: { orderBy: { order: "asc" } },
              },
            },
          },
        },
      },
    });

    const lines: string[] = [];
    for (const dept of departments) {
      for (const proj of dept.projects) {
        for (const mt of proj.mainTasks) {
          const subs = mt.subTasks;
          const done = subs.filter((s) => s.done).length;
          const total = subs.length;
          const isComplete = total > 0 && done === total;
          if (!include_done && isComplete) continue;
          lines.push(
            `[${isComplete ? "完了" : `${done}/${total}`}] ${dept.name} > ${proj.name} > ${mt.name}` +
              (mt.dueDate ? ` (期限: ${mt.dueDate.toISOString().slice(0, 10)})` : "") +
              (mt.assignee ? ` [担当: ${mt.assignee.name}]` : "")
          );
          for (const sub of subs) {
            if (!include_done && sub.done) continue;
            lines.push(
              `  ${sub.done ? "[x]" : "[ ]"} ${sub.name}` +
                (sub.dueDate ? ` (期限: ${sub.dueDate.toISOString().slice(0, 10)})` : "")
            );
          }
        }
      }
    }
    return {
      content: [{ type: "text" as const, text: lines.length > 0 ? lines.join("\n") : "タスクがありません" }],
    };
  }
);

server.tool(
  "search_tasks",
  "タスクをキーワードで検索",
  {
    user_email: z.string().describe("ユーザーのメールアドレス"),
    query: z.string().describe("検索キーワード"),
  },
  async ({ user_email, query }) => {
    const user = await prisma.user.findUnique({ where: { email: user_email } });
    if (!user) return { content: [{ type: "text" as const, text: "ユーザーが見つかりません" }] };
    const q = `%${query}%`;
    const mainTasks = await prisma.mainTask.findMany({
      where: {
        project: { userId: user.id },
        OR: [{ name: { contains: query } }, { summary: { contains: query } }],
      },
      include: { project: { include: { department: true } }, assignee: true, subTasks: true },
    });
    const subTasks = await prisma.subTask.findMany({
      where: {
        mainTask: { project: { userId: user.id } },
        OR: [{ name: { contains: query } }, { summary: { contains: query } }],
      },
      include: { mainTask: { include: { project: { include: { department: true } } } } },
    });

    const lines: string[] = [];
    for (const mt of mainTasks) {
      lines.push(`[メインタスク] ${mt.project.department.name} > ${mt.project.name} > ${mt.name}`);
      if (mt.summary) lines.push(`  概要: ${mt.summary}`);
    }
    for (const st of subTasks) {
      const mt = st.mainTask;
      lines.push(
        `[サブタスク] ${mt.project.department.name} > ${mt.project.name} > ${mt.name} > ${st.name}` +
          ` ${st.done ? "[完了]" : "[未完了]"}`
      );
      if (st.summary) lines.push(`  概要: ${st.summary}`);
    }
    return {
      content: [{ type: "text" as const, text: lines.length > 0 ? lines.join("\n") : "該当なし" }],
    };
  }
);

server.tool(
  "overdue_tasks",
  "期限切れのタスクを一覧表示",
  {
    user_email: z.string().describe("ユーザーのメールアドレス"),
  },
  async ({ user_email }) => {
    const user = await prisma.user.findUnique({ where: { email: user_email } });
    if (!user) return { content: [{ type: "text" as const, text: "ユーザーが見つかりません" }] };
    const now = new Date();
    const mainTasks = await prisma.mainTask.findMany({
      where: {
        project: { userId: user.id },
        dueDate: { lt: now },
        completedAt: null,
      },
      include: { project: { include: { department: true } }, assignee: true, subTasks: true },
      orderBy: { dueDate: "asc" },
    });
    const subTasks = await prisma.subTask.findMany({
      where: {
        mainTask: { project: { userId: user.id } },
        dueDate: { lt: now },
        done: false,
      },
      include: { mainTask: { include: { project: { include: { department: true } } } } },
      orderBy: { dueDate: "asc" },
    });

    const lines: string[] = [];
    for (const mt of mainTasks) {
      const done = mt.subTasks.filter((s) => s.done).length;
      lines.push(
        `[メインタスク] ${mt.project.department.name} > ${mt.project.name} > ${mt.name}` +
          ` (期限: ${mt.dueDate!.toISOString().slice(0, 10)}, 進捗: ${done}/${mt.subTasks.length})` +
          (mt.assignee ? ` [担当: ${mt.assignee.name}]` : "")
      );
    }
    for (const st of subTasks) {
      const mt = st.mainTask;
      lines.push(
        `[サブタスク] ${mt.project.department.name} > ${mt.project.name} > ${mt.name} > ${st.name}` +
          ` (期限: ${st.dueDate!.toISOString().slice(0, 10)})`
      );
    }
    return {
      content: [{ type: "text" as const, text: lines.length > 0 ? lines.join("\n") : "期限切れタスクなし" }],
    };
  }
);

server.tool(
  "list_assignees",
  "担当者の一覧を取得",
  { user_email: z.string().describe("ユーザーのメールアドレス") },
  async ({ user_email }) => {
    const user = await prisma.user.findUnique({ where: { email: user_email } });
    if (!user) return { content: [{ type: "text" as const, text: "ユーザーが見つかりません" }] };
    const assignees = await prisma.assignee.findMany({
      where: { userId: user.id },
      include: {
        _count: { select: { projects: true, mainTasks: true } },
      },
    });
    const result = assignees.map((a) => ({
      id: a.id,
      name: a.name,
      projectCount: a._count.projects,
      mainTaskCount: a._count.mainTasks,
    }));
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// ---------- Start ----------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
