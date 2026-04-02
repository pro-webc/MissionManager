import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

async function verifyMissionAccess(id: string, userId: string) {
  const mission = await prisma.mission.findUnique({
    where: { id },
    include: { genre: true },
  });
  if (!mission) return null;
  if (mission.genre.userId !== userId) return null;
  return mission;
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
    const mission = await verifyMissionAccess(id, session.user.id);
    if (!mission) {
      return NextResponse.json({ error: "ミッションが見つかりません" }, { status: 404 });
    }

    const body = await request.json();
    const data: { name?: string; summary?: string | null; dueDate?: Date | null } = {};
    if (body.name !== undefined) data.name = (body.name ?? "").trim();
    if (body.summary !== undefined) data.summary = body.summary?.trim() || null;
    if (body.due_date !== undefined) {
      data.dueDate = body.due_date && typeof body.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.due_date)
        ? new Date(body.due_date)
        : null;
    }

    if (data.name === "") {
      return NextResponse.json({ error: "名前は空にできません" }, { status: 400 });
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ mission });
    }

    const updated = await prisma.mission.update({
      where: { id },
      data,
    });
    return NextResponse.json({ mission: updated });
  } catch (error) {
    console.error("PATCH /api/missions/[id]:", error);
    return NextResponse.json(
      { error: "ミッションの更新に失敗しました" },
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
    const mission = await verifyMissionAccess(id, session.user.id);
    if (!mission) {
      return NextResponse.json({ error: "ミッションが見つかりません" }, { status: 404 });
    }

    await prisma.mission.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/missions/[id]:", error);
    return NextResponse.json(
      { error: "ミッションの削除に失敗しました" },
      { status: 500 }
    );
  }
}
