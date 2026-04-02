import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

async function moveGenre(id: string, direction: "up" | "down") {
  const genre = await prisma.genre.findUnique({ where: { id } });
  if (!genre) return { error: "ジャンルが見つかりません", status: 404 as const };

  const siblings = await prisma.genre.findMany({
    where: { userId: genre.userId },
    orderBy: { order: "asc" },
  });
  const idx = siblings.findIndex((g) => g.id === id);
  if (idx < 0) return { error: "ジャンルが見つかりません", status: 404 as const };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) {
    return { error: "これ以上移動できません", status: 400 as const };
  }

  // order が重複している場合、スワップでは変化しないため並べ替えて再番号付けする
  const reordered = [...siblings];
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
  const minOrder = Math.min(...siblings.map((g) => g.order));
  await prisma.$transaction(
    reordered.map((g, i) =>
      prisma.genre.update({
        where: { id: g.id },
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

    const genre = await prisma.genre.findUnique({ where: { id } });
    if (!genre || genre.userId !== session.user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const result = await moveGenre(id, direction);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/genres/[id]/move/[direction]:", error);
    return NextResponse.json(
      { error: "順序変更に失敗しました" },
      { status: 500 }
    );
  }
}
