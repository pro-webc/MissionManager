import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

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
    const assignee = await prisma.assignee.findUnique({ where: { id } });
    if (!assignee || assignee.userId !== session.user.id) {
      return NextResponse.json({ error: "担当者が見つかりません" }, { status: 404 });
    }
    await prisma.assignee.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/assignees/[id]:", error);
    return NextResponse.json(
      { error: "担当者の削除に失敗しました" },
      { status: 500 }
    );
  }
}
