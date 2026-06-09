export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Konversi Date → tanggal WIB string (YYYY-MM-DD)
function toWIBKey(date: Date): string {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0]
}

function fmtDate(dateISO: string) {
  return new Date(`${dateISO}T12:00:00+07:00`).toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const startDate = sp.get("startDate")
    const endDate   = sp.get("endDate")

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: "startDate and endDate required" }, { status: 400 })
    }

    // ✅ Range pakai WIB eksplisit
    const start = new Date(`${startDate}T00:00:00+07:00`)
    const end   = new Date(`${endDate}T23:59:59.999+07:00`)

    const [transactions, expenses] = await Promise.all([
      prisma.transaction.findMany({
        where: { paidAt: { gte: start, lte: end }, isVoid: false },
        include: {
          order: {
            include: {
              items: { include: { menuItem: { select: { name: true, category: { select: { name: true } } } } } },
              createdBy: { select: { name: true } },
            },
          },
        },
        orderBy: { paidAt: "asc" },
      }),
      prisma.expense.findMany({
        where: { date: { gte: start, lte: end } },
        include: { recordedBy: { select: { name: true } } },
        orderBy: { date: "asc" },
      }),
    ])

    // Previous period
    const diffMs    = end.getTime() - start.getTime()
    const prevEnd   = new Date(start.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - diffMs)

    const [prevRevAgg, prevExpAgg, prevCount] = await Promise.all([
      prisma.transaction.aggregate({ where: { paidAt: { gte: prevStart, lte: prevEnd }, isVoid: false }, _sum: { totalAmount: true } }),
      prisma.expense.aggregate({ where: { date: { gte: prevStart, lte: prevEnd } }, _sum: { amount: true } }),
      prisma.transaction.count({ where: { paidAt: { gte: prevStart, lte: prevEnd }, isVoid: false } }),
    ])

    // ✅ Daily map pakai WIB date key
    const dailyMap = new Map<string, { revenue: number; expenses: number; count: number }>()
    const cursor = new Date(`${startDate}T12:00:00+07:00`)
    const endCursor = new Date(`${endDate}T12:00:00+07:00`)
    while (cursor <= endCursor) {
      dailyMap.set(toWIBKey(cursor), { revenue: 0, expenses: 0, count: 0 })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    let totalRevenue = 0, totalCount = 0
    let cashRev = 0, cashCount = 0, qrisRev = 0, qrisCount = 0
    let dineInRev = 0, dineInCount = 0, takeawayRev = 0, takeawayCount = 0

    for (const tx of transactions) {
      const key   = toWIBKey(tx.paidAt)  // ✅ WIB key
      const entry = dailyMap.get(key)
      if (entry) { entry.revenue += tx.totalAmount; entry.count++ }
      totalRevenue += tx.totalAmount; totalCount++

      if (tx.paymentMethod === "CASH") { cashRev += tx.totalAmount; cashCount++ }
      else { qrisRev += tx.totalAmount; qrisCount++ }

      if (tx.order.type === "DINE_IN") { dineInRev += tx.totalAmount; dineInCount++ }
      else { takeawayRev += tx.totalAmount; takeawayCount++ }
    }

    let totalExpenses = 0
    for (const exp of expenses) {
      const key   = toWIBKey(exp.date)  // ✅ WIB key
      const entry = dailyMap.get(key)
      if (entry) entry.expenses += exp.amount
      totalExpenses += exp.amount
    }

    const daily = Array.from(dailyMap.entries())
      .map(([date, d]) => ({
        date,
        dateFormatted: fmtDate(date),  // ✅ pakai WIB ISO
        revenue:  d.revenue,
        expenses: d.expenses,
        profit:   d.revenue - d.expenses,
        count:    d.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const daysWithRevenue = daily.filter((d) => d.revenue > 0)
    const bestDay  = daysWithRevenue.length > 0 ? daysWithRevenue.reduce((a, b) => a.revenue > b.revenue ? a : b) : null
    const worstDay = daysWithRevenue.length > 0 ? daysWithRevenue.reduce((a, b) => a.revenue < b.revenue ? a : b) : null

    // Menu sales
    const menuMap = new Map<string, { name: string; category: string; qty: number; revenue: number }>()
    for (const tx of transactions) {
      for (const item of tx.order.items) {
        const rev = item.priceAtOrder * item.quantity
        const m   = menuMap.get(item.menuItemId)
        if (m) { m.qty += item.quantity; m.revenue += rev }
        else menuMap.set(item.menuItemId, { name: item.menuItem.name, category: item.menuItem.category.name, qty: item.quantity, revenue: rev })
      }
    }

    const transactionList = transactions.map((tx) => ({
      orderNumber: tx.order.orderNumber,
      date:   toWIBKey(tx.paidAt),  // ✅ WIB
      time:   new Date(tx.paidAt.getTime() + 7 * 60 * 60 * 1000)
                .toISOString().substring(11, 16).replace(":", "."),
      type:   tx.order.type === "DINE_IN" ? "Dine-In" : "Takeaway",
      method: tx.paymentMethod === "CASH" ? "Tunai" : "QRIS",
      total:  tx.totalAmount,
      cashier: tx.order.createdBy?.name || "Pelanggan",
      items:  tx.order.items.map((i) => `${i.menuItem.name} x${i.quantity}`).join(", "),
    }))

    const expenseList = expenses.map((e) => ({
      date:        toWIBKey(e.date),  // ✅ WIB
      description: e.description,
      amount:      e.amount,
      recordedBy:  e.recordedBy?.name || "-",
    }))

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses, totalCount,
          avgDailyRevenue: daily.length > 0 ? Math.round(totalRevenue / daily.length) : 0,
          bestDay, worstDay,
          cash:     { count: cashCount,     revenue: cashRev },
          qris:     { count: qrisCount,     revenue: qrisRev },
          dineIn:   { count: dineInCount,   revenue: dineInRev },
          takeaway: { count: takeawayCount, revenue: takeawayRev },
          hasExpenses: totalExpenses > 0,
        },
        previous: {
          revenue:  prevRevAgg._sum.totalAmount || 0,
          expenses: prevExpAgg._sum.amount || 0,
          profit:   (prevRevAgg._sum.totalAmount || 0) - (prevExpAgg._sum.amount || 0),
          count:    prevCount,
        },
        daily,
        menuSales: Array.from(menuMap.values()).sort((a, b) => b.qty - a.qty),
        transactionList,
        expenseList,
      },
    })
  } catch (error) {
    console.error("Range report error:", error)
    return NextResponse.json({ success: false, error: "Gagal memuat laporan" }, { status: 500 })
  }
}