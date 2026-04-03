import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { sortSubTasksByDueAndIncomplete } from "@/lib/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; direction: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const { id, direction } = await params;
    if (direction !== "up" && direction !== "down") {
      return NextResponse.json({ error: "direction は up または down です" }, { status: 400 });
    }

    const subTask = await prisma.subTask.findUnique({
      where: { id },
      include: { mainTask: { include: { project: true } } },
    });
    if (!subTask || subTask.mainTask.project.userId !== session.user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const siblings = await prisma.subTask.findMany({
      where: { mainTaskId: subTask.mainTaskId },
      orderBy: { order: "asc" },
    });
    const sorted = sortSubTasksByDueAndIncomplete(siblings);
    const idx = sorted.findIndex((t) => t.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: "サブタスクが見つかりません" }, { status: 404 });
    }

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) {
      return NextResponse.json({ error: "これ以上移動できません" }, { status: 400 });
    }

    const a = sorted[idx];
    const b = sorted[swapIdx];
    if (a.done !== b.done) {
      return NextResponse.json(
        { error: "期限が優先されます" },
        { status: 400 }
      );
    }
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDue !== bDue) {
      return NextResponse.json(
        { error: "期限が優先されます" },
        { status: 400 }
      );
    }

    const groupStart = sorted.findIndex(
      (t) => t.done === a.done && (t.dueDate ? new Date(t.dueDate).getTime() : Infinity) === aDue
    );
    const diffIdx = sorted.slice(groupStart).findIndex(
      (t) =>
        t.done !== a.done ||
        (t.dueDate ? new Date(t.dueDate).getTime() : Infinity) !== aDue
    );
    const groupEnd = diffIdx < 0 ? sorted.length : groupStart + diffIdx;
    const group = sorted.slice(groupStart, groupEnd);
    const groupIdx = idx - groupStart;
    const groupSwapIdx = swapIdx - groupStart;
    const reordered = [...group];
    [reordered[groupIdx], reordered[groupSwapIdx]] = [
      reordered[groupSwapIdx],
      reordered[groupIdx],
    ];
    const minOrder = Math.min(...group.map((t) => t.order));
    await prisma.$transaction(
      reordered.map((t, i) =>
        prisma.subTask.update({
          where: { id: t.id },
          data: { order: minOrder + i },
        })
      )
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/sub-tasks/[id]/move/[direction]:", error);
    return NextResponse.json(
      { error: "順序変更に失敗しました" },
      { status: 500 }
    );
  }
}
