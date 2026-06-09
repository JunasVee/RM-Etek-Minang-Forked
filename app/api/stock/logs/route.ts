export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date")
    const menuItemId = request.nextUrl.searchParams.get("menuItemId")

    const where: any = {}

    if (dateParam === "today") {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      where.createdAt = { gte: start, lte: end }
    }

    if (menuItemId) {
      where.menuItemId = menuItemId
    }

    const logs = await prisma.stockLog.findMany({
      where,
      include: {
        menuItem: { select: { name: true, category: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return NextResponse.json({ success: true, data: logs })
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal memuat log stok" },
      { status: 500 }
    )
  }
}
