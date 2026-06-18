jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET as GET_PROFIT } from "@/app/api/reports/profit/route"
import { GET as GET_WEEKLY } from "@/app/api/reports/profit/weekly/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── GET /api/reports/profit ────────────────────────────────
describe("GET /api/reports/profit", () => {
  it("mengembalikan data profit harian", async () => {
    mockPrisma.transaction.aggregate.mockResolvedValue({
      _sum: { totalAmount: 300000 }, _count: 15,
    })
    mockPrisma.expense.aggregate.mockResolvedValue({
      _sum: { amount: 80000 }, _count: 5,
    })

    const req = new NextRequest("http://localhost/api/reports/profit?date=2025-06-18")
    const res = await GET_PROFIT(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.totalRevenue).toBe(300000)
    expect(data.data.totalExpenses).toBe(80000)
    expect(data.data.profit).toBe(220000)
    expect(data.data.hasExpenses).toBe(true)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.aggregate.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/reports/profit?date=2025-06-18")
    const res = await GET_PROFIT(req)
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/reports/profit/weekly ─────────────────────────
describe("GET /api/reports/profit/weekly", () => {
  it("mengembalikan profit 7 hari", async () => {
    for (let i = 0; i < 7; i++) {
      mockPrisma.transaction.aggregate.mockResolvedValueOnce({
        _sum: { totalAmount: 100000 }, _count: 5,
      })
      mockPrisma.expense.aggregate.mockResolvedValueOnce({
        _sum: { amount: 20000 },
      })
    }

    const res = await GET_WEEKLY()
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(7)
    expect(data.data[0].revenue).toBe(100000)
    expect(data.data[0].expenses).toBe(20000)
    expect(data.data[0].profit).toBe(80000)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.aggregate.mockRejectedValue(new Error("DB"))

    const res = await GET_WEEKLY()
    expect(res.status).toBe(500)
  })
})
