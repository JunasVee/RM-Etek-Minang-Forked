export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date")

    const where: any = {}
    if (dateParam) {
      const date = new Date(dateParam)
      const start = new Date(`${dateParam}T00:00:00+07:00`)
      const end = new Date(`${dateParam}T23:59:59.999+07:00`)
      where.paidAt = { gte: start, lte: end }
    }

    const [total, cash, qris] = await Promise.all([
      prisma.transaction.aggregate({
        where,
        _count: true,
        _sum: { totalAmount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...where, paymentMethod: "CASH" },
        _count: true,
        _sum: { totalAmount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...where, paymentMethod: "QRIS" },
        _count: true,
        _sum: { totalAmount: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        totalCount: total._count,
        totalRevenue: total._sum.totalAmount || 0,
        cashCount: cash._count,
        cashRevenue: cash._sum.totalAmount || 0,
        qrisCount: qris._count,
        qrisRevenue: qris._sum.totalAmount || 0,
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal memuat ringkasan" },
      { status: 500 }
    )
  }
}
