export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date")
    const date = dateParam ? new Date(dateParam) : new Date()
    const start = new Date(`${dateParam}T00:00:00+07:00`)
    const end = new Date(`${dateParam}T23:59:59.999+07:00`)

    const [revenue, expenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: { paidAt: { gte: start, lte: end } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { date: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
    ])

    const totalRevenue = revenue._sum.totalAmount || 0
    const totalExpenses = expenses._sum.amount || 0
    const profit = totalRevenue - totalExpenses

    return NextResponse.json({
      success: true,
      data: {
        date: start.toISOString().split("T")[0],
        totalRevenue,
        revenueCount: revenue._count,
        totalExpenses,
        expenseCount: expenses._count,
        profit,
        hasExpenses: expenses._count > 0,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat data profit" }, { status: 500 })
  }
}
