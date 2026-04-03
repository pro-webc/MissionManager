import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { mainTasks: true },
    });
    if (!project) {
      return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
    }
    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = await request.json();
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "名前は空にできません" },
        { status: 400 }
      );
    }

    const dueDate = body.due_date && typeof body.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.due_date)
      ? new Date(body.due_date)
      : null;

    const assigneeId = body.assignee_id || null;

    const order = project.mainTasks.length;
    const mainTask = await prisma.mainTask.create({
      data: {
        projectId,
        name,
        summary: body.summary?.trim() || null,
        dueDate,
        assigneeId,
        order,
      },
    });

    return NextResponse.json({ mainTask });
  } catch (error) {
    console.error("POST /api/projects/[id]/main-tasks:", error);
    return NextResponse.json(
      { error: "メインタスクの追加に失敗しました" },
      { status: 500 }
    );
  }
}
