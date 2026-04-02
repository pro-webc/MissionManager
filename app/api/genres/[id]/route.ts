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
    const genre = await prisma.genre.findUnique({ where: { id } });
    if (!genre) {
      return NextResponse.json({ error: "ジャンルが見つかりません" }, { status: 404 });
    }
    if (genre.userId !== session.user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    const body = await request.json();
    const data: { name?: string; summary?: string | null } = {};
    if (body.name !== undefined) data.name = (body.name ?? "").trim();
    if (body.summary !== undefined) data.summary = body.summary?.trim() || null;

    if (data.name === "") {
      return NextResponse.json({ error: "名前は空にできません" }, { status: 400 });
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ genre });
    }

    const updated = await prisma.genre.update({
      where: { id },
      data,
    });
    return NextResponse.json({ genre: updated });
  } catch (error) {
    console.error("PATCH /api/genres/[id]:", error);
    return NextResponse.json(
      { error: "ジャンルの更新に失敗しました" },
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
    const genre = await prisma.genre.findUnique({ where: { id } });
    if (!genre) {
      return NextResponse.json({ error: "ジャンルが見つかりません" }, { status: 404 });
    }
    if (genre.userId !== session.user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    await prisma.genre.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/genres/[id]:", error);
    return NextResponse.json(
      { error: "ジャンルの削除に失敗しました" },
      { status: 500 }
    );
  }
}
