export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseDateRange, getPreviousPeriod } from "@/lib/analytics"

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const { start, end } = parseDateRange(sp.get("startDate"), sp.get("endDate"))
    const { prevStart, prevEnd } = getPreviousPeriod(start, end)

    const [current, previous] = await Promise.all([
      prisma.transaction.aggregate({ where: { paidAt: { gte: start, lte: end } }, _sum: { totalAmount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { paidAt: { gte: prevStart, lte: prevEnd } }, _sum: { totalAmount: true }, _count: true }),
    ])

    const curRev = current._sum.totalAmount || 0
    const prevRev = previous._sum.totalAmount || 0
    const curCount = current._count
    const prevCount = previous._count

    const revChange = prevRev > 0 ? Math.round(((curRev - prevRev) / prevRev) * 100) : null
    const countChange = prevCount > 0 ? Math.round(((curCount - prevCount) / prevCount) * 100) : null

    return NextResponse.json({
      success: true,
      data: {
        current: { revenue: curRev, count: curCount },
        previous: { revenue: prevRev, count: prevCount },
        revenueChange: revChange,
        countChange: countChange,
      },
    })
  } catch { return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 }) }
}
