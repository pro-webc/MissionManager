import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

async function moveProject(id: string, direction: "up" | "down") {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return { error: "プロジェクトが見つかりません", status: 404 as const };

  const siblings = await prisma.project.findMany({
    where: { userId: project.userId, departmentId: project.departmentId },
    orderBy: { order: "asc" },
  });
  const idx = siblings.findIndex((p) => p.id === id);
  if (idx < 0) return { error: "プロジェクトが見つかりません", status: 404 as const };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) {
    return { error: "これ以上移動できません", status: 400 as const };
  }

  const reordered = [...siblings];
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
  const minOrder = Math.min(...siblings.map((p) => p.order));
  await prisma.$transaction(
    reordered.map((p, i) =>
      prisma.project.update({
        where: { id: p.id },
        data: { order: minOrder + i },
      })
    )
  );
  return { ok: true };
}

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

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const result = await moveProject(id, direction);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/projects/[id]/move/[direction]:", error);
    return NextResponse.json(
      { error: "順序変更に失敗しました" },
      { status: 500 }
    );
  }
}
