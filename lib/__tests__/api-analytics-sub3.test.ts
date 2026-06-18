jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET as GET_TREND } from "@/app/api/analytics/menu-trend/route"
import { GET as GET_STOCK_EFF } from "@/app/api/analytics/stock-efficiency/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── GET /api/analytics/menu-trend ──────────────────────────
describe("GET /api/analytics/menu-trend", () => {
  it("mengembalikan 400 jika menuItemId tidak ada", async () => {
    const req = new NextRequest("http://localhost/api/analytics/menu-trend?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_TREND(req)
    expect(res.status).toBe(400)
  })

  it("mengembalikan trend penjualan menu", async () => {
    mockPrisma.orderItem.findMany.mockResolvedValue([
      {
        menuItemId: "m1", quantity: 3,
        order: { transaction: { paidAt: new Date("2025-06-18T10:00:00Z") } },
      },
      {
        menuItemId: "m1", quantity: 2,
        order: { transaction: { paidAt: new Date("2025-06-17T10:00:00Z") } },
      },
    ])

    const req = new NextRequest("http://localhost/api/analytics/menu-trend?menuItemId=m1&startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_TREND(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(2)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.orderItem.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/analytics/menu-trend?menuItemId=m1&startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_TREND(req)
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/analytics/stock-efficiency ────────────────────
describe("GET /api/analytics/stock-efficiency", () => {
  it("mengembalikan data efisiensi stok", async () => {
    mockPrisma.stockLog.findMany.mockResolvedValue([
      { menuItemId: "m1", quantity: 20 },
    ])
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { menuItemId: "m1", quantity: 15 },
    ])
    mockPrisma.restockNotification.findMany.mockResolvedValue([
      { menuItemId: "m1" },
    ])
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: "m1", name: "Rendang", initialStock: 20, category: { name: "Makanan" } },
    ])

    const req = new NextRequest("http://localhost/api/analytics/stock-efficiency?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_STOCK_EFF(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(1)
    expect(data.data[0].name).toBe("Rendang")
    expect(data.data[0].restockCount).toBe(1)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.stockLog.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/analytics/stock-efficiency?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_STOCK_EFF(req)
    expect(res.status).toBe(500)
  })
})
