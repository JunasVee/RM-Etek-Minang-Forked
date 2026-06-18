jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET } from "@/app/api/analytics/all/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

function setupMocks() {
  const now = new Date()
  const txs = [
    {
      totalAmount: 50000, paymentMethod: "CASH", paidAt: now,
      order: { type: "DINE_IN", source: "POS" },
    },
    {
      totalAmount: 30000, paymentMethod: "QRIS", paidAt: now,
      order: { type: "TAKEAWAY", source: "ONLINE" },
    },
  ]

  const expenses = [
    { amount: 15000, date: now, description: "bahan baku ayam" },
    { amount: 8000, date: now, description: "gas lpg" },
  ]

  const orderItems = [
    {
      menuItemId: "m1", priceAtOrder: 25000, quantity: 2,
      menuItem: { name: "Rendang", category: { name: "Makanan" } },
    },
    {
      menuItemId: "m2", priceAtOrder: 10000, quantity: 3,
      menuItem: { name: "Es Teh", category: { name: "Minuman" } },
    },
  ]

  const menuItems = [
    { id: "m1", name: "Rendang", initialStock: 20, category: { name: "Makanan" } },
    { id: "m2", name: "Es Teh", initialStock: 50, category: { name: "Minuman" } },
  ]

  // Promise.all order: transactions, expenses, prevRevAgg, prevExpAgg, prevCountAgg,
  //   menuItems, orderItems, restockNotifs, soldItems, resets
  mockPrisma.transaction.findMany.mockResolvedValue(txs)
  mockPrisma.expense.findMany.mockResolvedValue(expenses)
  mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { totalAmount: 60000 }, _count: 5 })
  mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 10000 } })
  mockPrisma.transaction.count.mockResolvedValue(5)
  mockPrisma.menuItem.findMany.mockResolvedValue(menuItems)
  mockPrisma.orderItem.findMany
    .mockResolvedValueOnce(orderItems)  // orderItems
    .mockResolvedValueOnce([            // soldItems
      { menuItemId: "m1", quantity: 2 },
      { menuItemId: "m2", quantity: 3 },
    ])
  mockPrisma.restockNotification.findMany.mockResolvedValue([])
  mockPrisma.stockLog.findMany.mockResolvedValue([])
}

describe("GET /api/analytics/all", () => {
  it("mengembalikan data analytics lengkap", async () => {
    setupMocks()

    const req = new NextRequest("http://localhost/api/analytics/all?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET(req)
    const data = await res.json()

    expect(data.success).toBe(true)

    // Revenue
    expect(data.data.revenue.totalRevenue).toBe(80000)
    expect(data.data.revenue.totalCount).toBe(2)
    expect(data.data.revenue.byMethod.cash.revenue).toBe(50000)
    expect(data.data.revenue.byMethod.qris.revenue).toBe(30000)
    expect(data.data.revenue.byType.dineIn.revenue).toBe(50000)
    expect(data.data.revenue.byType.takeaway.revenue).toBe(30000)

    // Menu performance
    expect(data.data.menuPerf.bestSellers.length).toBeGreaterThan(0)
    expect(data.data.menuPerf.categories.length).toBeGreaterThan(0)

    // Profit
    expect(data.data.profit.totalRevenue).toBe(80000)
    expect(data.data.profit.totalExpenses).toBe(23000)
    expect(data.data.profit.profit).toBe(57000)

    // Peak hours & day of week
    expect(data.data.peakHours).toBeDefined()
    expect(data.data.dayOfWeek).toHaveLength(7)

    // Stock efficiency
    expect(data.data.stockEfficiency).toBeDefined()
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/analytics/all?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
