import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    if (!departmentId) {
      return NextResponse.json({ error: "departmentId は必須です" }, { status: 400 });
    }
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id, departmentId },
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
    });
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("GET /api/projects:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const body = await request.json();
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "名前は空にできません" },
        { status: 400 }
      );
    }
    const departmentId = (body.departmentId ?? "").trim();
    if (!departmentId) {
      return NextResponse.json(
        { error: "departmentId は必須です" },
        { status: 400 }
      );
    }
    const count = await prisma.project.count({
      where: { userId: session.user.id, departmentId },
    });
    const dueDate = body.due_date && /^\d{4}-\d{2}-\d{2}$/.test(body.due_date)
      ? new Date(body.due_date + "T00:00:00Z")
      : null;
    const assigneeId = body.assignee_id?.trim() || null;
    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        departmentId,
        name,
        summary: body.summary?.trim() || null,
        dueDate,
        assigneeId,
        order: count,
      },
      include: { assignee: true },
    });
    return NextResponse.json({ project });
  } catch (error) {
    console.error("POST /api/projects:", error);
    return NextResponse.json(
      { error: "プロジェクトの追加に失敗しました" },
      { status: 500 }
    );
  }
}
