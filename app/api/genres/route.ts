import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const genres = await prisma.genre.findMany({
      where: { userId: session.user.id },
      orderBy: { order: "asc" },
      include: {
        missions: {
          orderBy: { order: "asc" },
          include: {
            tasks: { orderBy: { order: "asc" } },
          },
        },
      },
    });
    return NextResponse.json({ genres });
  } catch (error) {
    console.error("GET /api/genres:", error);
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
    const count = await prisma.genre.count({
      where: { userId: session.user.id },
    });
    const genre = await prisma.genre.create({
      data: {
        userId: session.user.id,
        name,
        summary: body.summary?.trim() || null,
        order: count,
      },
    });
    return NextResponse.json({ genre });
  } catch (error) {
    console.error("POST /api/genres:", error);
    return NextResponse.json(
      { error: "ジャンルの追加に失敗しました" },
      { status: 500 }
    );
  }
}
