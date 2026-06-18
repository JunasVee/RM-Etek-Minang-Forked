jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET } from "@/app/api/reports/range/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

describe("GET /api/reports/range", () => {
  it("mengembalikan 400 jika tanggal tidak disediakan", async () => {
    const req = new NextRequest("http://localhost/api/reports/range")
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it("mengembalikan laporan range lengkap", async () => {
    const now = new Date("2025-06-18T10:00:00+07:00")
    const txs = [
      {
        totalAmount: 50000, paymentMethod: "CASH", paidAt: now,
        order: {
          type: "DINE_IN", orderNumber: "RM-001",
          items: [
            {
              menuItemId: "m1", priceAtOrder: 25000, quantity: 2,
              menuItem: { name: "Rendang", category: { name: "Makanan" } },
            },
          ],
          createdBy: { name: "Kasir 1" },
        },
      },
    ]
    const expenses = [
      { amount: 10000, date: now, description: "bahan baku", recordedBy: { name: "Admin" } },
    ]

    mockPrisma.transaction.findMany.mockResolvedValue(txs)
    mockPrisma.expense.findMany.mockResolvedValue(expenses)
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { totalAmount: 40000 } })
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 5000 } })
    mockPrisma.transaction.count.mockResolvedValue(3)

    const req = new NextRequest("http://localhost/api/reports/range?startDate=2025-06-18&endDate=2025-06-18")
    const res = await GET(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.summary.totalRevenue).toBe(50000)
    expect(data.data.summary.totalExpenses).toBe(10000)
    expect(data.data.summary.profit).toBe(40000)
    expect(data.data.summary.totalCount).toBe(1)
    expect(data.data.summary.cash.count).toBe(1)
    expect(data.data.summary.dineIn.count).toBe(1)
    expect(data.data.daily).toBeDefined()
    expect(data.data.menuSales).toHaveLength(1)
    expect(data.data.transactionList).toHaveLength(1)
    expect(data.data.expenseList).toHaveLength(1)
    expect(data.data.previous).toBeDefined()
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/reports/range?startDate=2025-06-18&endDate=2025-06-18")
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
