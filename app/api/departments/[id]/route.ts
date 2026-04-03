import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const existing = await prisma.department.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "部門が見つかりません" },
        { status: 404 }
      );
    }
    const body = await request.json();
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "名前は空にできません" },
        { status: 400 }
      );
    }
    const department = await prisma.department.update({
      where: { id: params.id },
      data: { name },
    });
    return NextResponse.json({ department });
  } catch (error) {
    console.error("PATCH /api/departments/[id]:", error);
    return NextResponse.json(
      { error: "部門の更新に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const existing = await prisma.department.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "部門が見つかりません" },
        { status: 404 }
      );
    }
    await prisma.department.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/departments/[id]:", error);
    return NextResponse.json(
      { error: "部門の削除に失敗しました" },
      { status: 500 }
    );
  }
}
