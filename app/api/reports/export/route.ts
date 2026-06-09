export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date")
    if (!dateParam) {
      return NextResponse.json({ success: false, error: "Tanggal wajib diisi" }, { status: 400 })
    }

    const date = new Date(dateParam)
    const start = new Date(`${dateParam}T00:00:00+07:00`)
    const end = new Date(`${dateParam}T23:59:59.999+07:00`)

    // Revenue & method breakdown
    const [total, cash, qris, dineIn, takeaway] = await Promise.all([
      prisma.transaction.aggregate({ where: { paidAt: { gte: start, lte: end } }, _count: true, _sum: { totalAmount: true } }),
      prisma.transaction.aggregate({ where: { paidAt: { gte: start, lte: end }, paymentMethod: "CASH" }, _count: true, _sum: { totalAmount: true } }),
      prisma.transaction.aggregate({ where: { paidAt: { gte: start, lte: end }, paymentMethod: "QRIS" }, _count: true, _sum: { totalAmount: true } }),
      prisma.transaction.aggregate({ where: { paidAt: { gte: start, lte: end }, order: { type: "DINE_IN" } }, _count: true, _sum: { totalAmount: true } }),
      prisma.transaction.aggregate({ where: { paidAt: { gte: start, lte: end }, order: { type: "TAKEAWAY" } }, _count: true, _sum: { totalAmount: true } }),
    ])

    // Expenses
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      include: { recordedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    })
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

    // Menu sales
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: { status: "PAID", transactions: { some: { paidAt: { gte: start, lte: end } } } },
      },
      include: { menuItem: { select: { name: true, category: { select: { name: true } } } } },
    })

    const salesMap = new Map<string, { name: string; category: string; quantity: number; price: number; total: number }>()
    for (const item of orderItems) {
      const key = item.menuItemId
      const existing = salesMap.get(key)
      if (existing) {
        existing.quantity += item.quantity
        existing.total += item.priceAtOrder * item.quantity
      } else {
        salesMap.set(key, {
          name: item.menuItem.name, category: item.menuItem.category.name,
          quantity: item.quantity, price: item.priceAtOrder, total: item.priceAtOrder * item.quantity,
        })
      }
    }
    const menuSales = Array.from(salesMap.values()).sort((a, b) => b.quantity - a.quantity)

    // Transactions list
    const transactions = await prisma.transaction.findMany({
      where: { paidAt: { gte: start, lte: end } },
      include: {
        order: {
          include: {
            items: { include: { menuItem: { select: { name: true } } } },
            createdBy: { select: { name: true } },
          },
        },
      },
      orderBy: { paidAt: "asc" },
    })

    const totalRevenue = total._sum.totalAmount || 0

    return NextResponse.json({
      success: true,
      data: {
        date: dateParam,
        dateFormatted: start.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
        summary: {
          totalRevenue,
          totalExpenses,
          profit: totalRevenue - totalExpenses,
          transactionCount: total._count,
          cash: { count: cash._count, revenue: cash._sum.totalAmount || 0 },
          qris: { count: qris._count, revenue: qris._sum.totalAmount || 0 },
          dineIn: { count: dineIn._count, revenue: dineIn._sum.totalAmount || 0 },
          takeaway: { count: takeaway._count, revenue: takeaway._sum.totalAmount || 0 },
          hasExpenses: expenses.length > 0,
        },
        menuSales,
        expenses: expenses.map((e) => ({
          description: e.description, amount: e.amount, recordedBy: e.recordedBy.name,
          time: new Date(e.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        })),
        transactions: transactions.map((tx) => ({
          orderNumber: tx.order.orderNumber,
          type: tx.order.type === "DINE_IN" ? "Dine-In" : "Takeaway",
          method: tx.paymentMethod === "CASH" ? "Tunai" : "QRIS",
          total: tx.totalAmount,
          cashier: tx.order.createdBy?.name || "Pelanggan",
          time: new Date(tx.paidAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          items: tx.order.items.map((i) => `${i.menuItem.name} x${i.quantity}`).join(", "),
        })),
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat data export" }, { status: 500 })
  }
}
