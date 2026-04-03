import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

async function verifyMainTaskAccess(id: string, userId: string) {
  const mainTask = await prisma.mainTask.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!mainTask) return null;
  if (mainTask.project.userId !== userId) return null;
  return mainTask;
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
    const mainTask = await verifyMainTaskAccess(id, session.user.id);
    if (!mainTask) {
      return NextResponse.json({ error: "メインタスクが見つかりません" }, { status: 404 });
    }

    const body = await request.json();
    const data: { name?: string; summary?: string | null; dueDate?: Date | null; assigneeId?: string | null } = {};
    if (body.name !== undefined) data.name = (body.name ?? "").trim();
    if (body.summary !== undefined) data.summary = body.summary?.trim() || null;
    if (body.due_date !== undefined) {
      data.dueDate = body.due_date && typeof body.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.due_date)
        ? new Date(body.due_date)
        : null;
    }
    if (body.assignee_id !== undefined) {
      data.assigneeId = body.assignee_id || null;
    }

    if (data.name === "") {
      return NextResponse.json({ error: "名前は空にできません" }, { status: 400 });
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ mainTask });
    }

    const updated = await prisma.mainTask.update({
      where: { id },
      data,
    });
    return NextResponse.json({ mainTask: updated });
  } catch (error) {
    console.error("PATCH /api/main-tasks/[id]:", error);
    return NextResponse.json(
      { error: "メインタスクの更新に失敗しました" },
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
    const mainTask = await verifyMainTaskAccess(id, session.user.id);
    if (!mainTask) {
      return NextResponse.json({ error: "メインタスクが見つかりません" }, { status: 404 });
    }

    await prisma.mainTask.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/main-tasks/[id]:", error);
    return NextResponse.json(
      { error: "メインタスクの削除に失敗しました" },
      { status: 500 }
    );
  }
}
