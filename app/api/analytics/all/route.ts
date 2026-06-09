export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseDateRange, getPreviousPeriod } from "@/lib/analytics"

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const { start, end } = parseDateRange(sp.get("startDate"), sp.get("endDate"))
    const { prevStart, prevEnd } = getPreviousPeriod(start, end)
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))

    // Fetch all data in parallel
    const [transactions, expenses, prevRevAgg, prevExpAgg, prevCountAgg, menuItems, orderItems, restockNotifs, soldItems, resets] = await Promise.all([
      prisma.transaction.findMany({
        where: { paidAt: { gte: start, lte: end } },
        select: { totalAmount: true, paymentMethod: true, paidAt: true, order: { select: { type: true, source: true } } },
        orderBy: { paidAt: "asc" },
      }),
      prisma.expense.findMany({
        where: { date: { gte: start, lte: end } },
        select: { amount: true, date: true, description: true },
      }),
      prisma.transaction.aggregate({ where: { paidAt: { gte: prevStart, lte: prevEnd } }, _sum: { totalAmount: true }, _count: true }),
      prisma.expense.aggregate({ where: { date: { gte: prevStart, lte: prevEnd } }, _sum: { amount: true } }),
      prisma.transaction.count({ where: { paidAt: { gte: prevStart, lte: prevEnd } } }),
      prisma.menuItem.findMany({ where: { isActive: true }, select: { id: true, name: true, initialStock: true, category: { select: { name: true } } } }),
      prisma.orderItem.findMany({
        where: { order: { status: "PAID", transactions: { some: { paidAt: { gte: start, lte: end } } } } },
        include: { menuItem: { select: { name: true, category: { select: { name: true } } } } },
      }),
      prisma.restockNotification.findMany({ where: { createdAt: { gte: start, lte: end } }, select: { menuItemId: true } }),
      prisma.orderItem.findMany({
        where: { order: { status: "PAID", transactions: { some: { paidAt: { gte: start, lte: end } } } } },
        select: { menuItemId: true, quantity: true },
      }),
      prisma.stockLog.findMany({
        where: { changeType: "DAILY_RESET", createdAt: { gte: start, lte: end }, quantity: { gt: 0 } },
        select: { menuItemId: true, quantity: true },
      }),
    ])

    // ===== REVENUE =====
    const dailyMap = new Map<string, { revenue: number; count: number }>()
    let totalRevenue = 0, totalCount = 0
    let cashRev = 0, cashCount = 0, qrisRev = 0, qrisCount = 0
    let dineInRev = 0, dineInCount = 0, takeawayRev = 0, takeawayCount = 0
    let onlineRev = 0, onlineCount = 0

    for (const tx of transactions) {
      const dk = tx.paidAt.toISOString().split("T")[0]
      const e = dailyMap.get(dk) || { revenue: 0, count: 0 }
      e.revenue += tx.totalAmount; e.count++; dailyMap.set(dk, e)
      totalRevenue += tx.totalAmount; totalCount++

      if (tx.paymentMethod === "CASH") { cashRev += tx.totalAmount; cashCount++ }
      else { qrisRev += tx.totalAmount; qrisCount++ }

      if (tx.order.type === "DINE_IN") { dineInRev += tx.totalAmount; dineInCount++ }
      else { takeawayRev += tx.totalAmount; takeawayCount++ }

      if (tx.order.source === "ONLINE") { onlineRev += tx.totalAmount; onlineCount++ }
    }

    const daily = Array.from(dailyMap.entries()).map(([date, d]) => ({ date, revenue: d.revenue, count: d.count }))

    const curRev = totalRevenue, prevRev = prevRevAgg._sum.totalAmount || 0
    const revChange = prevRev > 0 ? Math.round(((curRev - prevRev) / prevRev) * 100) : null
    const countChange = prevCountAgg > 0 ? Math.round(((totalCount - prevCountAgg) / prevCountAgg) * 100) : null

    // ===== MENU PERFORMANCE =====
    const menuMap = new Map<string, { name: string; category: string; qty: number; revenue: number }>()
    const catMap = new Map<string, { qty: number; revenue: number }>()
    let grandTotal = 0

    for (const item of orderItems) {
      const rev = item.priceAtOrder * item.quantity
      grandTotal += rev
      const m = menuMap.get(item.menuItemId)
      if (m) { m.qty += item.quantity; m.revenue += rev }
      else { menuMap.set(item.menuItemId, { name: item.menuItem.name, category: item.menuItem.category.name, qty: item.quantity, revenue: rev }) }

      const c = catMap.get(item.menuItem.category.name)
      if (c) { c.qty += item.quantity; c.revenue += rev }
      else { catMap.set(item.menuItem.category.name, { qty: item.quantity, revenue: rev }) }
    }

    const allMenuItems = Array.from(menuMap.values())
    const bestSellers = [...allMenuItems].sort((a, b) => b.qty - a.qty).slice(0, 10)
      .map((m, i) => ({ ...m, rank: i + 1, pct: grandTotal > 0 ? Math.round((m.revenue / grandTotal) * 100) : 0 }))
    const worstSellers = [...allMenuItems].sort((a, b) => a.qty - b.qty).slice(0, 5)
      .map((m) => ({ ...m, pct: grandTotal > 0 ? Math.round((m.revenue / grandTotal) * 100) : 0 }))
    const categories = Array.from(catMap.entries()).map(([name, d]) => ({
      name, qty: d.qty, revenue: d.revenue, pct: grandTotal > 0 ? Math.round((d.revenue / grandTotal) * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue)

    // ===== PEAK HOURS =====
    const hourMap = new Map<number, { count: number; revenue: number }>()
    for (let h = 6; h <= 22; h++) hourMap.set(h, { count: 0, revenue: 0 })
    for (const tx of transactions) {
      const h = tx.paidAt.getHours()
      const e = hourMap.get(h)
      if (e) { e.count++; e.revenue += tx.totalAmount }
    }
    const peakHours = Array.from(hourMap.entries()).map(([hour, d]) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      count: d.count, avgCount: Math.round((d.count / days) * 10) / 10, revenue: d.revenue,
    }))

    // ===== DAY OF WEEK =====
    const dowMap = new Map<number, { count: number; revenue: number; days: Set<string> }>()
    for (let d = 0; d < 7; d++) dowMap.set(d, { count: 0, revenue: 0, days: new Set() })
    for (const tx of transactions) {
      const dow = tx.paidAt.getDay()
      const e = dowMap.get(dow)!
      e.count++; e.revenue += tx.totalAmount; e.days.add(tx.paidAt.toISOString().split("T")[0])
    }
    const dayOfWeek = [1, 2, 3, 4, 5, 6, 0].map((dow) => {
      const d = dowMap.get(dow)!
      const ud = Math.max(1, d.days.size)
      return { day: DAY_NAMES[dow], totalRevenue: d.revenue, totalCount: d.count, avgRevenue: Math.round(d.revenue / ud), avgCount: Math.round((d.count / ud) * 10) / 10 }
    })

    // ===== PROFIT =====
    const profitDailyMap = new Map<string, { revenue: number; expenses: number }>()
    for (const tx of transactions) {
      const d = tx.paidAt.toISOString().split("T")[0]
      const e = profitDailyMap.get(d) || { revenue: 0, expenses: 0 }
      e.revenue += tx.totalAmount; profitDailyMap.set(d, e)
    }
    let totalExpenses = 0
    for (const exp of expenses) {
      const d = exp.date.toISOString().split("T")[0]
      const e = profitDailyMap.get(d) || { revenue: 0, expenses: 0 }
      e.expenses += exp.amount; profitDailyMap.set(d, e)
      totalExpenses += exp.amount
    }
    const profitDaily = Array.from(profitDailyMap.entries())
      .map(([date, d]) => ({ date, revenue: d.revenue, expenses: d.expenses, profit: d.revenue - d.expenses }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const profit = totalRevenue - totalExpenses
    const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0

    const prevProfit = (prevRevAgg._sum.totalAmount || 0) - (prevExpAgg._sum.amount || 0)
    const prevMargin = (prevRevAgg._sum.totalAmount || 0) > 0 ? Math.round((prevProfit / (prevRevAgg._sum.totalAmount || 1)) * 100) : 0

    // Expense categories
    const expCatMap = new Map<string, number>()
    for (const exp of expenses) {
      const desc = exp.description.toLowerCase()
      let cat = "Lainnya"
      if (desc.includes("bahan baku") || desc.includes("sayur") || desc.includes("bumbu")) cat = "Bahan Baku"
      else if (desc.includes("gas") || desc.includes("lpg")) cat = "Gas LPG"
      else if (desc.includes("listrik")) cat = "Listrik"
      else if (desc.includes("perlengkapan")) cat = "Perlengkapan"
      else if (desc.includes("es batu")) cat = "Es Batu"
      expCatMap.set(cat, (expCatMap.get(cat) || 0) + exp.amount)
    }
    const expenseCategories = Array.from(expCatMap.entries())
      .map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)

    // ===== STOCK EFFICIENCY =====
    const resetMap = new Map<string, number>()
    for (const r of resets) resetMap.set(r.menuItemId, (resetMap.get(r.menuItemId) || 0) + r.quantity)
    const soldMap = new Map<string, number>()
    for (const s of soldItems) soldMap.set(s.menuItemId, (soldMap.get(s.menuItemId) || 0) + s.quantity)
    const notifMap = new Map<string, number>()
    for (const n of restockNotifs) notifMap.set(n.menuItemId, (notifMap.get(n.menuItemId) || 0) + 1)

    const stockEfficiency = menuItems.map((m) => {
      const tc = resetMap.get(m.id) || (m.initialStock * days)
      const ts = soldMap.get(m.id) || 0
      const waste = Math.max(0, tc - ts)
      return {
        name: m.name, category: m.category.name,
        avgCooked: Math.round((tc / days) * 10) / 10, avgSold: Math.round((ts / days) * 10) / 10,
        avgWaste: Math.round((waste / days) * 10) / 10, wastePct: tc > 0 ? Math.round((waste / tc) * 100) : 0,
        restockCount: notifMap.get(m.id) || 0,
      }
    }).sort((a, b) => b.wastePct - a.wastePct)

    return NextResponse.json({
      success: true,
      data: {
        revenue: {
          totalRevenue, totalCount,
          avgRevenuePerDay: Math.round(totalRevenue / days),
          avgTransactionValue: totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0,
          daily,
          byMethod: { cash: { revenue: cashRev, count: cashCount }, qris: { revenue: qrisRev, count: qrisCount } },
          byType: { dineIn: { revenue: dineInRev, count: dineInCount }, takeaway: { revenue: takeawayRev, count: takeawayCount }, online: { revenue: onlineRev, count: onlineCount } },
        },
        comparison: { revenueChange: revChange, countChange },
        menuPerf: { bestSellers, worstSellers, categories, grandTotal },
        peakHours,
        dayOfWeek,
        profit: { totalRevenue, totalExpenses, profit, margin, prevMargin, daily: profitDaily, expenseCategories },
        stockEfficiency,
        menuItemsList: menuItems.map((m) => ({ id: m.id, name: m.name })),
      },
    })
  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 })
  }
}
