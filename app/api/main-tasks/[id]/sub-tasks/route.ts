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
    const { id: mainTaskId } = await params;

    const mainTask = await prisma.mainTask.findUnique({
      where: { id: mainTaskId },
      include: { project: true, subTasks: true },
    });
    if (!mainTask) {
      return NextResponse.json({ error: "メインタスクが見つかりません" }, { status: 404 });
    }
    if (mainTask.project.userId !== session.user.id) {
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

    const summary = body.summary && typeof body.summary === "string" ? body.summary.trim() || null : null;

    const order = mainTask.subTasks.length;
    const subTask = await prisma.subTask.create({
      data: {
        mainTaskId,
        name,
        summary,
        dueDate,
        order,
      },
    });

    return NextResponse.json({ subTask });
  } catch (error) {
    console.error("POST /api/main-tasks/[id]/sub-tasks:", error);
    return NextResponse.json(
      { error: "サブタスクの追加に失敗しました" },
      { status: 500 }
    );
  }
}
