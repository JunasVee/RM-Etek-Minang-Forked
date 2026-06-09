export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseDateRange } from "@/lib/analytics"

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const { start, end } = parseDateRange(sp.get("startDate"), sp.get("endDate"))

    const items = await prisma.orderItem.findMany({
      where: { order: { status: "PAID", transactions: { some: { paidAt: { gte: start, lte: end } } } } },
      include: { menuItem: { select: { name: true, category: { select: { name: true } } } } },
    })

    // Aggregate by menu item
    const menuMap = new Map<string, { name: string; category: string; qty: number; revenue: number }>()
    const catMap = new Map<string, { qty: number; revenue: number }>()
    let grandTotal = 0

    for (const item of items) {
      const key = item.menuItemId
      const rev = item.priceAtOrder * item.quantity
      grandTotal += rev

      const m = menuMap.get(key)
      if (m) { m.qty += item.quantity; m.revenue += rev }
      else { menuMap.set(key, { name: item.menuItem.name, category: item.menuItem.category.name, qty: item.quantity, revenue: rev }) }

      const c = catMap.get(item.menuItem.category.name)
      if (c) { c.qty += item.quantity; c.revenue += rev }
      else { catMap.set(item.menuItem.category.name, { qty: item.quantity, revenue: rev }) }
    }

    const allItems = Array.from(menuMap.values())
    const bestSellers = [...allItems].sort((a, b) => b.qty - a.qty).slice(0, 10)
      .map((m, i) => ({ ...m, rank: i + 1, pct: grandTotal > 0 ? Math.round((m.revenue / grandTotal) * 100) : 0 }))
    const worstSellers = [...allItems].sort((a, b) => a.qty - b.qty).slice(0, 5)
      .map((m) => ({ ...m, pct: grandTotal > 0 ? Math.round((m.revenue / grandTotal) * 100) : 0 }))

    const categories = Array.from(catMap.entries()).map(([name, d]) => ({
      name, qty: d.qty, revenue: d.revenue, pct: grandTotal > 0 ? Math.round((d.revenue / grandTotal) * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({ success: true, data: { bestSellers, worstSellers, categories, grandTotal } })
  } catch { return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 }) }
}
