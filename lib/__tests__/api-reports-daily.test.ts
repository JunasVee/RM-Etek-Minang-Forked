jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET } from "@/app/api/reports/daily/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

describe("GET /api/reports/daily", () => {
  const agg = { _count: 5, _sum: { totalAmount: 200000 } }
  const aggZero = { _count: 0, _sum: { totalAmount: null } }

  it("mengembalikan laporan harian", async () => {
    // Promise.all: [total, cash, qris, dineIn, takeaway]
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce(agg)
      .mockResolvedValueOnce({ _count: 3, _sum: { totalAmount: 120000 } })
      .mockResolvedValueOnce({ _count: 2, _sum: { totalAmount: 80000 } })
      .mockResolvedValueOnce({ _count: 4, _sum: { totalAmount: 160000 } })
      .mockResolvedValueOnce({ _count: 1, _sum: { totalAmount: 40000 } })
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { name: "Rendang", currentStock: 0, initialStock: 20 },
      { name: "Es Teh", currentStock: 10, initialStock: 50 },
    ])

    const req = new NextRequest("http://localhost/api/reports/daily?date=2025-06-18")
    const res = await GET(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.totalRevenue).toBe(200000)
    expect(data.data.totalCount).toBe(5)
    expect(data.data.cash.count).toBe(3)
    expect(data.data.stock.outOfStock).toHaveLength(1)
    expect(data.data.stock.remaining).toHaveLength(1)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.aggregate.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/reports/daily?date=2025-06-18")
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
