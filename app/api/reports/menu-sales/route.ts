export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date")
    const date = dateParam ? new Date(dateParam) : new Date()
    const start = new Date(`${dateParam}T00:00:00+07:00`)
    const end = new Date(`${dateParam}T23:59:59.999+07:00`)

    // Get all order items from PAID orders on this date
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: "PAID",
          transactions: { some: { paidAt: { gte: start, lte: end } } },
        },
      },
      include: {
        menuItem: {
          select: { name: true, category: { select: { name: true } } },
        },
      },
    })

    // Aggregate by menu item
    const salesMap = new Map<string, {
      name: string; category: string;
      quantity: number; price: number; total: number
    }>()

    for (const item of orderItems) {
      const key = item.menuItemId
      const existing = salesMap.get(key)
      if (existing) {
        existing.quantity += item.quantity
        existing.total += item.priceAtOrder * item.quantity
      } else {
        salesMap.set(key, {
          name: item.menuItem.name,
          category: item.menuItem.category.name,
          quantity: item.quantity,
          price: item.priceAtOrder,
          total: item.priceAtOrder * item.quantity,
        })
      }
    }

    const sales = Array.from(salesMap.values())
      .sort((a, b) => b.quantity - a.quantity)

    const grandTotal = sales.reduce((s, i) => s + i.total, 0)
    const totalPortions = sales.reduce((s, i) => s + i.quantity, 0)

    return NextResponse.json({
      success: true,
      data: { items: sales, grandTotal, totalPortions },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat laporan menu" }, { status: 500 })
  }
}
