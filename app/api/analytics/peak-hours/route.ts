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
      select: { paidAt: true, totalAmount: true },
    })

    const hourMap = new Map<number, { count: number; revenue: number }>()
    for (let h = 6; h <= 22; h++) hourMap.set(h, { count: 0, revenue: 0 })

    for (const tx of transactions) {
      const h = tx.paidAt.getHours()
      const entry = hourMap.get(h)
      if (entry) { entry.count++; entry.revenue += tx.totalAmount }
    }

    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
    const hours = Array.from(hourMap.entries()).map(([hour, d]) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      count: d.count,
      avgCount: Math.round((d.count / days) * 10) / 10,
      revenue: d.revenue,
    }))

    return NextResponse.json({ success: true, data: hours })
  } catch { return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 }) }
}
