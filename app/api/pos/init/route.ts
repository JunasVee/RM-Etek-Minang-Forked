export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)

    const [categories, menuItems, openOrders] = await Promise.all([
      prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.menuItem.findMany({
        where: { isActive: true },
        include: { category: true },
        orderBy: { name: "asc" },
      }),
      prisma.order.findMany({
        where: {
          status: { in: ["OPEN", "PARTIALLY_PAID"] },
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        include: {
          items: { include: { menuItem: true } },
          createdBy: { select: { id: true, name: true } },
          transactions: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: { categories, menuItems, openOrders },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 })
  }
}
