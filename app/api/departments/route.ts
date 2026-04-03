import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const departments = await prisma.department.findMany({
      where: { userId: session.user.id },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ departments });
  } catch (error) {
    console.error("GET /api/departments:", error);
    return NextResponse.json(
      { error: "部門の取得に失敗しました" },
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
    const count = await prisma.department.count({
      where: { userId: session.user.id },
    });
    const department = await prisma.department.create({
      data: {
        userId: session.user.id,
        name,
        order: count,
      },
    });
    return NextResponse.json({ department });
  } catch (error) {
    console.error("POST /api/departments:", error);
    return NextResponse.json(
      { error: "部門の追加に失敗しました" },
      { status: 500 }
    );
  }
}
