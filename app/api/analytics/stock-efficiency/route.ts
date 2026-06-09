export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseDateRange } from "@/lib/analytics"

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const { start, end } = parseDateRange(sp.get("startDate"), sp.get("endDate"))
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))

    // Get stock logs for resets (to know daily initial stock)
    const resets = await prisma.stockLog.findMany({
      where: { changeType: "DAILY_RESET", createdAt: { gte: start, lte: end }, quantity: { gt: 0 } },
      select: { menuItemId: true, quantity: true },
    })

    // Get sold quantities
    const sold = await prisma.orderItem.findMany({
      where: { order: { status: "PAID", transactions: { some: { paidAt: { gte: start, lte: end } } } } },
      select: { menuItemId: true, quantity: true },
    })

    // Get restock notification count
    const notifs = await prisma.restockNotification.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { menuItemId: true },
    })

    const menuItems = await prisma.menuItem.findMany({
      where: { isActive: true },
      select: { id: true, name: true, initialStock: true, category: { select: { name: true } } },
    })

    // Aggregate
    const resetMap = new Map<string, number>()
    for (const r of resets) resetMap.set(r.menuItemId, (resetMap.get(r.menuItemId) || 0) + r.quantity)

    const soldMap = new Map<string, number>()
    for (const s of sold) soldMap.set(s.menuItemId, (soldMap.get(s.menuItemId) || 0) + s.quantity)

    const notifMap = new Map<string, number>()
    for (const n of notifs) notifMap.set(n.menuItemId, (notifMap.get(n.menuItemId) || 0) + 1)

    const data = menuItems.map((m) => {
      const totalCooked = resetMap.get(m.id) || (m.initialStock * days)
      const totalSold = soldMap.get(m.id) || 0
      const waste = Math.max(0, totalCooked - totalSold)
      const wastePct = totalCooked > 0 ? Math.round((waste / totalCooked) * 100) : 0
      return {
        name: m.name,
        category: m.category.name,
        avgCooked: Math.round((totalCooked / days) * 10) / 10,
        avgSold: Math.round((totalSold / days) * 10) / 10,
        avgWaste: Math.round((waste / days) * 10) / 10,
        wastePct,
        restockCount: notifMap.get(m.id) || 0,
      }
    }).sort((a, b) => b.wastePct - a.wastePct)

    return NextResponse.json({ success: true, data })
  } catch { return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 }) }
}
