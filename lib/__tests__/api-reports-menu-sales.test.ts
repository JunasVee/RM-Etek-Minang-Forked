jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET } from "@/app/api/reports/menu-sales/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

describe("GET /api/reports/menu-sales", () => {
  it("mengembalikan laporan penjualan menu", async () => {
    mockPrisma.orderItem.findMany.mockResolvedValue([
      {
        menuItemId: "m1", priceAtOrder: 25000, quantity: 3,
        menuItem: { name: "Rendang", category: { name: "Makanan" } },
      },
      {
        menuItemId: "m1", priceAtOrder: 25000, quantity: 2,
        menuItem: { name: "Rendang", category: { name: "Makanan" } },
      },
      {
        menuItemId: "m2", priceAtOrder: 8000, quantity: 5,
        menuItem: { name: "Es Teh", category: { name: "Minuman" } },
      },
    ])

    const req = new NextRequest("http://localhost/api/reports/menu-sales?date=2025-06-18")
    const res = await GET(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.items).toHaveLength(2)
    expect(data.data.items[0].name).toBe("Rendang")
    expect(data.data.items[0].quantity).toBe(5)
    expect(data.data.grandTotal).toBe(165000)
    expect(data.data.totalPortions).toBe(10)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.orderItem.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/reports/menu-sales?date=2025-06-18")
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
