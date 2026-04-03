import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const assignees = await prisma.assignee.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ assignees });
  } catch (error) {
    console.error("GET /api/assignees:", error);
    return NextResponse.json(
      { error: "担当者の取得に失敗しました" },
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
    const assignee = await prisma.assignee.create({
      data: { userId: session.user.id, name },
    });
    return NextResponse.json({ assignee });
  } catch (error) {
    console.error("POST /api/assignees:", error);
    return NextResponse.json(
      { error: "担当者の追加に失敗しました" },
      { status: 500 }
    );
  }
}
