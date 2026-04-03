import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

async function verifySubTaskAccess(id: string, userId: string) {
  const subTask = await prisma.subTask.findUnique({
    where: { id },
    include: { mainTask: { include: { project: true } } },
  });
  if (!subTask) return null;
  if (subTask.mainTask.project.userId !== userId) return null;
  return subTask;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const { id } = await params;
    const subTask = await verifySubTaskAccess(id, session.user.id);
    if (!subTask) {
      return NextResponse.json({ error: "サブタスクが見つかりません" }, { status: 404 });
    }

    const body = await request.json();
    const data: { name?: string; summary?: string | null; done?: boolean; completedAt?: Date | null; dueDate?: Date | null } = {};

    if (body.name !== undefined) {
      const name = (body.name ?? "").trim();
      if (name === "") {
        return NextResponse.json({ error: "名前は空にできません" }, { status: 400 });
      }
      data.name = name;
    }
    if (body.summary !== undefined) {
      data.summary = body.summary && typeof body.summary === "string" ? body.summary.trim() || null : null;
    }
    if (body.due_date !== undefined) {
      data.dueDate = body.due_date && typeof body.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.due_date)
        ? new Date(body.due_date)
        : null;
    }
    if (body.done !== undefined) {
      if (typeof body.done !== "boolean") {
        return NextResponse.json({ error: "done は boolean である必要があります" }, { status: 400 });
      }
      data.done = body.done;
      data.completedAt = body.done ? new Date() : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ subTask });
    }

    const updated = await prisma.subTask.update({
      where: { id },
      data,
    });

    if (data.done !== undefined) {
      if (data.done) {
        const mainTask = await prisma.mainTask.findUnique({
          where: { id: subTask.mainTaskId },
          include: { subTasks: true },
        });
        if (mainTask) {
          const allDone = mainTask.subTasks.every((t) => t.id === id || t.done);
          if (allDone) {
            await prisma.mainTask.update({
              where: { id: mainTask.id },
              data: { completedAt: new Date() },
            });
          }
        }
      } else {
        await prisma.mainTask.update({
          where: { id: subTask.mainTaskId },
          data: { completedAt: null },
        });
      }
    }

    return NextResponse.json({ subTask: updated });
  } catch (error) {
    console.error("PATCH /api/sub-tasks/[id]:", error);
    return NextResponse.json(
      { error: "サブタスクの更新に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const { id } = await params;
    const subTask = await verifySubTaskAccess(id, session.user.id);
    if (!subTask) {
      return NextResponse.json({ error: "サブタスクが見つかりません" }, { status: 404 });
    }

    await prisma.subTask.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/sub-tasks/[id]:", error);
    return NextResponse.json(
      { error: "サブタスクの削除に失敗しました" },
      { status: 500 }
    );
  }
}
