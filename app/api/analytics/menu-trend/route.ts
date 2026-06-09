export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseDateRange } from "@/lib/analytics"

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const menuItemId = sp.get("menuItemId")
    if (!menuItemId) return NextResponse.json({ success: false, error: "menuItemId required" }, { status: 400 })

    const { start, end } = parseDateRange(sp.get("startDate"), sp.get("endDate"))

    const items = await prisma.orderItem.findMany({
      where: {
        menuItemId,
        order: { status: "PAID", transactions: { some: { paidAt: { gte: start, lte: end } } } },
      },
      include: { order: { select: { transactions: { select: { paidAt: true } } } } },
    })

    const dailyMap = new Map<string, number>()
    for (const item of items) {
      const date = item.order.transactions[0]?.paidAt.toISOString().split("T")[0]
      if (date) dailyMap.set(date, (dailyMap.get(date) || 0) + item.quantity)
    }

    const trend = Array.from(dailyMap.entries())
      .map(([date, qty]) => ({ date, qty }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ success: true, data: trend })
  } catch { return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 }) }
}
