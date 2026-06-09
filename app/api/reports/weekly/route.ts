import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function wibDayRange(offsetDays: number) {
  const wib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000)
  wib.setUTCDate(wib.getUTCDate() - offsetDays)
  const dateISO = wib.toISOString().split("T")[0]
  return {
    start:   new Date(`${dateISO}T00:00:00+07:00`),
    end:     new Date(`${dateISO}T23:59:59.999+07:00`),
    dateISO,
  }
}

export async function GET() {
  try {
    const days = []

    for (let i = 6; i >= 0; i--) {
      const { start, end, dateISO } = wibDayRange(i)

      const result = await prisma.transaction.aggregate({
        where: { paidAt: { gte: start, lte: end }, isVoid: false },
        _count: true, _sum: { totalAmount: true },
      })

      days.push({
        date: new Date(`${dateISO}T12:00:00+07:00`).toLocaleDateString("id-ID", {
          weekday: "short", day: "numeric", month: "short",
        }),
        revenue: result._sum.totalAmount || 0,
        count:   result._count,
      })
    }

    return NextResponse.json({ success: true, data: days })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: "Gagal memuat laporan mingguan" }, { status: 500 })
  }
}