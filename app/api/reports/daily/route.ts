export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date")
    const date = dateParam ? new Date(dateParam) : new Date()
    const start = new Date(`${dateParam}T00:00:00+07:00`)
    const end = new Date(`${dateParam}T23:59:59.999+07:00`)

    const where = { paidAt: { gte: start, lte: end } }

    const [total, cash, qris, dineIn, takeaway] = await Promise.all([
      prisma.transaction.aggregate({ where, _count: true, _sum: { totalAmount: true } }),
      prisma.transaction.aggregate({ where: { ...where, paymentMethod: "CASH" }, _count: true, _sum: { totalAmount: true } }),
      prisma.transaction.aggregate({ where: { ...where, paymentMethod: "QRIS" }, _count: true, _sum: { totalAmount: true } }),
      prisma.transaction.aggregate({
        where: { ...where, order: { type: "DINE_IN" } },
        _count: true, _sum: { totalAmount: true },
      }),
      prisma.transaction.aggregate({
        where: { ...where, order: { type: "TAKEAWAY" } },
        _count: true, _sum: { totalAmount: true },
      }),
    ])

    // Stock summary
    const stockItems = await prisma.menuItem.findMany({
      where: { isActive: true },
      select: { name: true, currentStock: true, initialStock: true },
      orderBy: { currentStock: "asc" },
    })

    const totalRevenue = total._sum.totalAmount || 0
    const totalCount = total._count

    return NextResponse.json({
      success: true,
      data: {
        date: start.toISOString().split("T")[0],
        totalRevenue,
        totalCount,
        avgPerTransaction: totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0,
        cash: { count: cash._count, revenue: cash._sum.totalAmount || 0 },
        qris: { count: qris._count, revenue: qris._sum.totalAmount || 0 },
        dineIn: { count: dineIn._count, revenue: dineIn._sum.totalAmount || 0 },
        takeaway: { count: takeaway._count, revenue: takeaway._sum.totalAmount || 0 },
        stock: {
          outOfStock: stockItems.filter((i) => i.currentStock === 0),
          remaining: stockItems.filter((i) => i.currentStock > 0),
        },
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat laporan" }, { status: 500 })
  }
}
