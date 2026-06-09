export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date")
    const where: any = {}

    if (dateParam) {
      const date = new Date(dateParam)
      const start = new Date(date); start.setHours(0, 0, 0, 0)
      const end = new Date(date); end.setHours(23, 59, 59, 999)
      where.date = { gte: start, lte: end }
    }

    const result = await prisma.expense.aggregate({
      where,
      _count: true,
      _sum: { amount: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        count: result._count,
        total: result._sum.amount || 0,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat total" }, { status: 500 })
  }
}
