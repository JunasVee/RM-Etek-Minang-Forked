import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function wibDayRange(offsetDays: number) {
  const wib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000)
  wib.setUTCDate(wib.getUTCDate() - offsetDays)
  const dateISO = wib.toISOString().split("T")[0]
  return {
    start: new Date(`${dateISO}T00:00:00+07:00`),
    end:   new Date(`${dateISO}T23:59:59.999+07:00`),
    dateISO,
  }
}

export async function GET() {
  try {
    const days = []

    for (let i = 6; i >= 0; i--) {
      const { start, end, dateISO } = wibDayRange(i)

      const [rev, exp] = await Promise.all([
        prisma.transaction.aggregate({
          where: { paidAt: { gte: start, lte: end }, isVoid: false },
          _sum: { totalAmount: true }, _count: true,
        }),
        prisma.expense.aggregate({
          where: { date: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
      ])

      const revenue  = rev._sum.totalAmount || 0
      const expenses = exp._sum.amount || 0

      days.push({
        date: new Date(`${dateISO}T12:00:00+07:00`).toLocaleDateString("id-ID", {
          weekday: "short", day: "numeric", month: "short",
        }),
        dateISO,
        revenue, expenses,
        profit: revenue - expenses,
        txCount: rev._count,
      })
    }

    return NextResponse.json({ success: true, data: days })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: "Gagal memuat data mingguan" }, { status: 500 })
  }
}