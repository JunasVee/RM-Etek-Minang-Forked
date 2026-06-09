export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseDateRange } from "@/lib/analytics"

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const { start, end } = parseDateRange(sp.get("startDate"), sp.get("endDate"))

    const transactions = await prisma.transaction.findMany({
      where: { paidAt: { gte: start, lte: end } },
      select: { paidAt: true, totalAmount: true },
    })

    const dayMap = new Map<number, { count: number; revenue: number; days: Set<string> }>()
    for (let d = 0; d < 7; d++) dayMap.set(d, { count: 0, revenue: 0, days: new Set() })

    for (const tx of transactions) {
      const dow = tx.paidAt.getDay()
      const entry = dayMap.get(dow)!
      entry.count++
      entry.revenue += tx.totalAmount
      entry.days.add(tx.paidAt.toISOString().split("T")[0])
    }

    // Reorder Mon-Sun
    const ordered = [1, 2, 3, 4, 5, 6, 0]
    const data = ordered.map((dow) => {
      const d = dayMap.get(dow)!
      const uniqueDays = Math.max(1, d.days.size)
      return {
        day: DAY_NAMES[dow],
        totalRevenue: d.revenue,
        totalCount: d.count,
        avgRevenue: Math.round(d.revenue / uniqueDays),
        avgCount: Math.round((d.count / uniqueDays) * 10) / 10,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch { return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 }) }
}
