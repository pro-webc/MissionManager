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
    const { id: genreId } = await params;

    const genre = await prisma.genre.findUnique({
      where: { id: genreId },
      include: { missions: true },
    });
    if (!genre) {
      return NextResponse.json({ error: "ジャンルが見つかりません" }, { status: 404 });
    }
    if (genre.userId !== session.user.id) {
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

    const order = genre.missions.length;
    const mission = await prisma.mission.create({
      data: {
        genreId,
        name,
        summary: body.summary?.trim() || null,
        dueDate,
        order,
      },
    });

    return NextResponse.json({ mission });
  } catch (error) {
    console.error("POST /api/genres/[id]/missions:", error);
    return NextResponse.json(
      { error: "ミッションの追加に失敗しました" },
      { status: 500 }
    );
  }
}
