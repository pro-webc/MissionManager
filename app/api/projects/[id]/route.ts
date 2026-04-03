import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

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
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
    }
    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = await request.json();
    const data: { name?: string; summary?: string | null; dueDate?: Date | null; assigneeId?: string | null } = {};
    if (body.name !== undefined) data.name = (body.name ?? "").trim();
    if (body.summary !== undefined) data.summary = body.summary?.trim() || null;
    if (body.due_date !== undefined) {
      data.dueDate = body.due_date && /^\d{4}-\d{2}-\d{2}$/.test(body.due_date)
        ? new Date(body.due_date + "T00:00:00Z")
        : null;
    }
    if (body.assignee_id !== undefined) {
      data.assigneeId = body.assignee_id?.trim() || null;
    }

    if (data.name === "") {
      return NextResponse.json({ error: "名前は空にできません" }, { status: 400 });
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ project });
    }

    const updated = await prisma.project.update({
      where: { id },
      data,
    });
    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error("PATCH /api/projects/[id]:", error);
    return NextResponse.json(
      { error: "プロジェクトの更新に失敗しました" },
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
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
    }
    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/projects/[id]:", error);
    return NextResponse.json(
      { error: "プロジェクトの削除に失敗しました" },
      { status: 500 }
    );
  }
}
