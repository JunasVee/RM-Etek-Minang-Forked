jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET } from "@/app/api/transactions/[id]/receipt/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

const params = { params: { id: "t1" } }

describe("GET /api/transactions/[id]/receipt", () => {
  it("mengembalikan 404 jika transaksi tidak ditemukan", async () => {
    mockPrisma.transaction.findUnique.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/transactions/t1/receipt")
    const res = await GET(req, params as any)
    expect(res.status).toBe(404)
  })

  it("mengembalikan data struk", async () => {
    mockPrisma.transaction.findUnique.mockResolvedValue({
      id: "t1", totalAmount: 70000, paymentMethod: "CASH",
      cashReceived: 100000, changeAmount: 30000,
      paidAt: new Date("2025-06-18T10:00:00Z"),
      order: {
        orderNumber: "RM-001", type: "DINE_IN", tableNumber: 5,
        createdBy: { name: "Kasir 1" },
        items: [
          { menuItem: { name: "Rendang" }, quantity: 2, priceAtOrder: 25000 },
          { menuItem: { name: "Es Teh" }, quantity: 2, priceAtOrder: 10000 },
        ],
      },
    })

    const req = new NextRequest("http://localhost/api/transactions/t1/receipt")
    const res = await GET(req, params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.orderNumber).toBe("RM-001")
    expect(data.data.total).toBe(70000)
    expect(data.data.items).toHaveLength(2)
    expect(data.data.cashReceived).toBe(100000)
    expect(data.data.changeAmount).toBe(30000)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.findUnique.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/transactions/t1/receipt")
    const res = await GET(req, params as any)
    expect(res.status).toBe(500)
  })
})
