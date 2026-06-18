jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET } from "@/app/api/reports/export/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

describe("GET /api/reports/export", () => {
  it("mengembalikan 400 jika tanggal tidak ada", async () => {
    const req = new NextRequest("http://localhost/api/reports/export")
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it("mengembalikan data export lengkap", async () => {
    const now = new Date("2025-06-18T10:00:00+07:00")
    const agg = { _count: 5, _sum: { totalAmount: 200000 } }
    const aggCash = { _count: 3, _sum: { totalAmount: 120000 } }
    const aggQris = { _count: 2, _sum: { totalAmount: 80000 } }
    const aggDineIn = { _count: 4, _sum: { totalAmount: 160000 } }
    const aggTakeaway = { _count: 1, _sum: { totalAmount: 40000 } }

    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce(agg)
      .mockResolvedValueOnce(aggCash)
      .mockResolvedValueOnce(aggQris)
      .mockResolvedValueOnce(aggDineIn)
      .mockResolvedValueOnce(aggTakeaway)

    mockPrisma.expense.findMany.mockResolvedValue([
      { amount: 15000, description: "Bahan", createdAt: now, recordedBy: { name: "Admin" } },
    ])

    mockPrisma.orderItem.findMany.mockResolvedValue([
      {
        menuItemId: "m1", priceAtOrder: 25000, quantity: 2,
        menuItem: { name: "Rendang", category: { name: "Makanan" } },
      },
    ])

    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        totalAmount: 50000, paymentMethod: "CASH", paidAt: now,
        order: {
          orderNumber: "RM-001", type: "DINE_IN",
          items: [{ menuItem: { name: "Rendang" }, quantity: 2 }],
          createdBy: { name: "Kasir" },
        },
      },
    ])

    const req = new NextRequest("http://localhost/api/reports/export?date=2025-06-18")
    const res = await GET(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.summary.totalRevenue).toBe(200000)
    expect(data.data.summary.totalExpenses).toBe(15000)
    expect(data.data.menuSales).toHaveLength(1)
    expect(data.data.transactions).toHaveLength(1)
    expect(data.data.expenses).toHaveLength(1)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.aggregate.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/reports/export?date=2025-06-18")
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
