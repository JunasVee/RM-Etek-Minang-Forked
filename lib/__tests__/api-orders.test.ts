jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET, POST } from "@/app/api/orders/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── GET ────────────────────────────────────────────────────
describe("GET /api/orders", () => {
  it("mengembalikan semua pesanan tanpa filter", async () => {
    const orders = [{ id: "o1", orderNumber: "ORD-001", status: "OPEN" }]
    mockPrisma.order.findMany.mockResolvedValue(orders)

    const req = new NextRequest("http://localhost/api/orders")
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toEqual(orders)
  })

  it("memfilter berdasarkan satu status", async () => {
    mockPrisma.order.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/orders?status=OPEN")
    await GET(req)

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "OPEN" }),
      })
    )
  })

  it("memfilter berdasarkan multiple status (comma-separated)", async () => {
    mockPrisma.order.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/orders?status=OPEN,CONFIRMED")
    await GET(req)

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ["OPEN", "CONFIRMED"] } }),
      })
    )
  })

  it("memfilter date=today", async () => {
    mockPrisma.order.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/orders?date=today")
    await GET(req)

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    )
  })

  it("mengembalikan 500 saat prisma error", async () => {
    mockPrisma.order.findMany.mockRejectedValue(new Error("DB error"))

    const req = new NextRequest("http://localhost/api/orders")
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.success).toBe(false)
  })
})

// ─── POST ───────────────────────────────────────────────────
describe("POST /api/orders", () => {
  const menuItem = {
    id: "m1",
    name: "Rendang",
    price: 35000,
    currentStock: 50,
    initialStock: 100,
    minThreshold: 0.25,
  }

  const validBody = {
    type: "DINE_IN",
    tableNumber: 3,
    createdById: "user-1",
    items: [{ menuItemId: "m1", quantity: 2 }],
  }

  function postReq(body: object) {
    return new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("membuat pesanan baru", async () => {
    mockPrisma.order.count.mockResolvedValue(5)
    mockPrisma.menuItem.findMany.mockResolvedValue([menuItem])
    mockPrisma.order.create.mockResolvedValue({
      id: "o1",
      orderNumber: "ORD-20250618-00610",
      items: [{ menuItemId: "m1", quantity: 2, priceAtOrder: 35000 }],
    })
    mockPrisma.menuItem.update.mockResolvedValue({})
    mockPrisma.stockLog.createMany.mockResolvedValue({ count: 1 })
    mockPrisma.restockNotification.findMany.mockResolvedValue([])
    mockPrisma.restockNotification.createMany.mockResolvedValue({ count: 0 })

    const res = await POST(postReq(validBody))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.success).toBe(true)
    expect(mockPrisma.order.create).toHaveBeenCalled()
  })

  it("menolak jika data tidak lengkap", async () => {
    const res = await POST(postReq({ type: "DINE_IN" }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain("tidak lengkap")
  })

  it("menolak jika items kosong", async () => {
    const res = await POST(postReq({ ...validBody, items: [] }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain("tidak lengkap")
  })

  it("mengembalikan error jika menu tidak ditemukan", async () => {
    mockPrisma.order.count.mockResolvedValue(0)
    mockPrisma.menuItem.findMany.mockResolvedValue([])

    const res = await POST(postReq(validBody))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain("tidak ditemukan")
  })

  it("mengembalikan error jika stok tidak cukup", async () => {
    mockPrisma.order.count.mockResolvedValue(0)
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { ...menuItem, currentStock: 1 },
    ])

    const res = await POST(postReq(validBody))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain("tidak cukup")
  })
})
