export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseDateRange, getPreviousPeriod } from "@/lib/analytics"

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const { start, end } = parseDateRange(sp.get("startDate"), sp.get("endDate"))
    const { prevStart, prevEnd } = getPreviousPeriod(start, end)

    // Daily revenue
    const transactions = await prisma.transaction.findMany({
      where: { paidAt: { gte: start, lte: end } },
      select: { totalAmount: true, paidAt: true },
    })
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      select: { amount: true, date: true, description: true },
    })

    // Previous period
    const [prevRevAgg, prevExpAgg] = await Promise.all([
      prisma.transaction.aggregate({ where: { paidAt: { gte: prevStart, lte: prevEnd } }, _sum: { totalAmount: true } }),
      prisma.expense.aggregate({ where: { date: { gte: prevStart, lte: prevEnd } }, _sum: { amount: true } }),
    ])

    // Daily breakdown
    const dailyMap = new Map<string, { revenue: number; expenses: number }>()
    for (const tx of transactions) {
      const d = tx.paidAt.toISOString().split("T")[0]
      const entry = dailyMap.get(d) || { revenue: 0, expenses: 0 }
      entry.revenue += tx.totalAmount
      dailyMap.set(d, entry)
    }
    for (const exp of expenses) {
      const d = exp.date.toISOString().split("T")[0]
      const entry = dailyMap.get(d) || { revenue: 0, expenses: 0 }
      entry.expenses += exp.amount
      dailyMap.set(d, entry)
    }

    const daily = Array.from(dailyMap.entries())
      .map(([date, d]) => ({ date, revenue: d.revenue, expenses: d.expenses, profit: d.revenue - d.expenses }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const totalRevenue = transactions.reduce((s, t) => s + t.totalAmount, 0)
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const profit = totalRevenue - totalExpenses
    const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0

    const prevProfit = (prevRevAgg._sum.totalAmount || 0) - (prevExpAgg._sum.amount || 0)
    const prevMargin = (prevRevAgg._sum.totalAmount || 0) > 0
      ? Math.round((prevProfit / (prevRevAgg._sum.totalAmount || 1)) * 100) : 0

    // Expense breakdown by description keyword
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
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue, totalExpenses, profit, margin,
        prevMargin,
        daily, expenseCategories,
      },
    })
  } catch { return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 }) }
}
