jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET as GET_MENU_PERF } from "@/app/api/analytics/menu-performance/route"
import { GET as GET_COMPARISON } from "@/app/api/analytics/revenue/comparison/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── GET /api/analytics/menu-performance ────────────────────
describe("GET /api/analytics/menu-performance", () => {
  it("mengembalikan data performa menu", async () => {
    mockPrisma.orderItem.findMany.mockResolvedValue([
      {
        menuItemId: "m1", priceAtOrder: 25000, quantity: 5,
        menuItem: { name: "Rendang", category: { name: "Makanan" } },
      },
      {
        menuItemId: "m2", priceAtOrder: 8000, quantity: 10,
        menuItem: { name: "Es Teh", category: { name: "Minuman" } },
      },
    ])

    const req = new NextRequest("http://localhost/api/analytics/menu-performance?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_MENU_PERF(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.bestSellers.length).toBeGreaterThan(0)
    expect(data.data.categories.length).toBeGreaterThan(0)
    expect(data.data.grandTotal).toBe(205000)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.orderItem.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/analytics/menu-performance?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_MENU_PERF(req)
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/analytics/revenue/comparison ──────────────────
describe("GET /api/analytics/revenue/comparison", () => {
  it("mengembalikan perbandingan revenue", async () => {
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 500000 }, _count: 20 })
      .mockResolvedValueOnce({ _sum: { totalAmount: 400000 }, _count: 15 })

    const req = new NextRequest("http://localhost/api/analytics/revenue/comparison?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_COMPARISON(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.current.revenue).toBe(500000)
    expect(data.data.previous.revenue).toBe(400000)
    expect(data.data.revenueChange).toBe(25)
    expect(data.data.countChange).toBe(33)
  })

  it("mengembalikan null jika periode sebelumnya 0", async () => {
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 100000 }, _count: 5 })
      .mockResolvedValueOnce({ _sum: { totalAmount: null }, _count: 0 })

    const req = new NextRequest("http://localhost/api/analytics/revenue/comparison?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_COMPARISON(req)
    const data = await res.json()

    expect(data.data.revenueChange).toBeNull()
    expect(data.data.countChange).toBeNull()
  })
})
