import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

async function verifyTaskAccess(id: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: { mission: { include: { genre: true } } },
  });
  if (!task) return null;
  if (task.mission.genre.userId !== userId) return null;
  return task;
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
    const task = await verifyTaskAccess(id, session.user.id);
    if (!task) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
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
      return NextResponse.json({ task });
    }

    const updated = await prisma.task.update({
      where: { id },
      data,
    });

    if (data.done !== undefined) {
      if (data.done) {
        const mission = await prisma.mission.findUnique({
          where: { id: task.missionId },
          include: { tasks: true },
        });
        if (mission) {
          const allDone = mission.tasks.every((t) => t.id === id || t.done);
          if (allDone) {
            await prisma.mission.update({
              where: { id: mission.id },
              data: { completedAt: new Date() },
            });
          }
        }
      } else {
        await prisma.mission.update({
          where: { id: task.missionId },
          data: { completedAt: null },
        });
      }
    }

    return NextResponse.json({ task: updated });
  } catch (error) {
    console.error("PATCH /api/tasks/[id]:", error);
    return NextResponse.json(
      { error: "タスクの更新に失敗しました" },
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
    const task = await verifyTaskAccess(id, session.user.id);
    if (!task) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/tasks/[id]:", error);
    return NextResponse.json(
      { error: "タスクの削除に失敗しました" },
      { status: 500 }
    );
  }
}
