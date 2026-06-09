export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseDateRange } from "@/lib/analytics"

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const { start, end } = parseDateRange(sp.get("startDate"), sp.get("endDate"))

    const transactions = await prisma.transaction.findMany({
      where: { paidAt: { gte: start, lte: end } },
      select: { totalAmount: true, paymentMethod: true, paidAt: true, order: { select: { type: true, source: true } } },
      orderBy: { paidAt: "asc" },
    })

    // Daily breakdown
    const dailyMap = new Map<string, { revenue: number; count: number }>()
    let totalRevenue = 0, totalCount = 0
    let cashRevenue = 0, cashCount = 0, qrisRevenue = 0, qrisCount = 0
    let dineInRevenue = 0, dineInCount = 0, takeawayRevenue = 0, takeawayCount = 0
    let onlineRevenue = 0, onlineCount = 0

    for (const tx of transactions) {
      const dateKey = tx.paidAt.toISOString().split("T")[0]
      const entry = dailyMap.get(dateKey) || { revenue: 0, count: 0 }
      entry.revenue += tx.totalAmount
      entry.count += 1
      dailyMap.set(dateKey, entry)

      totalRevenue += tx.totalAmount
      totalCount += 1

      if (tx.paymentMethod === "CASH") { cashRevenue += tx.totalAmount; cashCount++ }
      else { qrisRevenue += tx.totalAmount; qrisCount++ }

      if (tx.order.type === "DINE_IN") { dineInRevenue += tx.totalAmount; dineInCount++ }
      else { takeawayRevenue += tx.totalAmount; takeawayCount++ }

      if (tx.order.source === "ONLINE") { onlineRevenue += tx.totalAmount; onlineCount++ }
    }

    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
    const daily = Array.from(dailyMap.entries()).map(([date, d]) => ({
      date, revenue: d.revenue, count: d.count,
    }))

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue, totalCount,
        avgRevenuePerDay: Math.round(totalRevenue / days),
        avgTransactionValue: totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0,
        daily,
        byMethod: { cash: { revenue: cashRevenue, count: cashCount }, qris: { revenue: qrisRevenue, count: qrisCount } },
        byType: { dineIn: { revenue: dineInRevenue, count: dineInCount }, takeaway: { revenue: takeawayRevenue, count: takeawayCount }, online: { revenue: onlineRevenue, count: onlineCount } },
      },
    })
  } catch { return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 }) }
}
