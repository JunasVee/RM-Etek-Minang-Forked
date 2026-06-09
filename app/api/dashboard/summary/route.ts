export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Helper: buat range start-end WIB untuk suatu tanggal ISO (YYYY-MM-DD)
function wibRange(dateISO: string) {
  return {
    start: new Date(`${dateISO}T00:00:00+07:00`),
    end:   new Date(`${dateISO}T23:59:59.999+07:00`),
  }
}

// Helper: ambil tanggal ISO (YYYY-MM-DD) berdasarkan WIB
function wibDateISO(offsetDays = 0): string {
  const now = new Date()
  // Geser ke WIB (UTC+7), lalu ambil tanggal
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  wib.setUTCDate(wib.getUTCDate() - offsetDays)
  return wib.toISOString().split("T")[0]
}

export async function GET() {
  try {
    const todayISO     = wibDateISO(0)
    const yesterdayISO = wibDateISO(1)

    const { start: todayStart, end: todayEnd }         = wibRange(todayISO)
    const { start: yesterdayStart, end: yesterdayEnd } = wibRange(yesterdayISO)

    const [todayRevAgg, todayExpAgg, yesterdayRevAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: { paidAt: { gte: todayStart, lte: todayEnd }, isVoid: false },
        _sum: { totalAmount: true }, _count: true,
      }),
      prisma.expense.aggregate({
        where: { date: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true }, _count: true,
      }),
      prisma.transaction.aggregate({
        where: { paidAt: { gte: yesterdayStart, lte: yesterdayEnd }, isVoid: false },
        _sum: { totalAmount: true },
      }),
    ])

    const todayRevenue    = todayRevAgg._sum.totalAmount || 0
    const todayExpenses   = todayExpAgg._sum.amount || 0
    const todayCount      = todayRevAgg._count
    const yesterdayRevenue = yesterdayRevAgg._sum.totalAmount || 0

    // Weekly trend (7 hari terakhir) — semua pakai WIB
    const weekly = []
    for (let i = 6; i >= 0; i--) {
      const dateISO = wibDateISO(i)
      const { start: s, end: e } = wibRange(dateISO)

      const [rev, exp] = await Promise.all([
        prisma.transaction.aggregate({
          where: { paidAt: { gte: s, lte: e }, isVoid: false },
          _sum: { totalAmount: true },
        }),
        prisma.expense.aggregate({
          where: { date: { gte: s, lte: e } },
          _sum: { amount: true },
        }),
      ])

      // Format label tanggal pakai WIB
      weekly.push({
        date: new Date(`${dateISO}T12:00:00+07:00`).toLocaleDateString("id-ID", {
          weekday: "short", day: "numeric", month: "short",
        }),
        revenue: rev._sum.totalAmount || 0,
        profit: (rev._sum.totalAmount || 0) - (exp._sum.amount || 0),
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        today: {
          revenue: todayRevenue,
          expenses: todayExpenses,
          profit: todayRevenue - todayExpenses,
          count: todayCount,
          hasExpenses: todayExpAgg._count > 0,
          avgPerTransaction: todayCount > 0 ? Math.round(todayRevenue / todayCount) : 0,
        },
        yesterdayRevenue,
        revChange: yesterdayRevenue > 0
          ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
          : null,
        weekly,
      },
    })
  } catch (error) {
    console.error("❌ Dashboard summary error:", error)
    return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 })
  }
}