jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET, POST } from "@/app/api/transactions/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── GET /api/transactions ──────────────────────────────────
describe("GET /api/transactions", () => {
  it("mengembalikan semua transaksi", async () => {
    const txs = [{ id: "t1", totalAmount: 100000 }]
    mockPrisma.transaction.findMany.mockResolvedValue(txs)

    const req = new NextRequest("http://localhost/api/transactions")
    const res = await GET(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toEqual(txs)
  })

  it("memfilter berdasarkan date", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/transactions?date=2025-06-18")
    await GET(req)

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paidAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      })
    )
  })

  it("memfilter berdasarkan method", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/transactions?method=CASH")
    await GET(req)

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paymentMethod: "CASH" }),
      })
    )
  })

  it("memfilter berdasarkan type order", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/transactions?type=DINE_IN")
    await GET(req)

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          order: { type: "DINE_IN" },
        }),
      })
    )
  })

  it("tidak filter type jika 'all'", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/transactions?type=all")
    await GET(req)

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ order: undefined }),
      })
    )
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/transactions")
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})

// ─── POST /api/transactions ─────────────────────────────────
describe("POST /api/transactions", () => {
  function postReq(body: object) {
    return new NextRequest("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("menolak jika data tidak lengkap", async () => {
    const res = await POST(postReq({ orderId: "" }))
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("tidak lengkap")
  })

  it("mengembalikan 404 jika pesanan tidak ditemukan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const res = await POST(postReq({ orderId: "o1", paymentMethod: "CASH", cashReceived: 50000 }))
    expect(res.status).toBe(404)
  })

  it("menolak jika pesanan sudah dibayar", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "PAID", transaction: { id: "t1" },
      items: [{ priceAtOrder: 50000, quantity: 1 }],
    })

    const res = await POST(postReq({ orderId: "o1", paymentMethod: "CASH", cashReceived: 50000 }))
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("sudah dibayar")
  })

  it("menolak jika pesanan dibatalkan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "CANCELLED", transaction: null,
      items: [{ priceAtOrder: 50000, quantity: 1 }],
    })

    const res = await POST(postReq({ orderId: "o1", paymentMethod: "CASH", cashReceived: 50000 }))
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("dibatalkan")
  })

  it("menolak jika uang tunai kurang", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "OPEN", transaction: null,
      items: [{ priceAtOrder: 50000, quantity: 2 }],
    })

    const res = await POST(postReq({ orderId: "o1", paymentMethod: "CASH", cashReceived: 50000 }))
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("tidak mencukupi")
  })

  it("berhasil membuat transaksi CASH", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "OPEN", transaction: null,
      items: [{ priceAtOrder: 35000, quantity: 2 }],
    })

    const mockTx = { id: "t1", totalAmount: 70000, paymentMethod: "CASH" }
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.transaction.create.mockResolvedValue(mockTx)

    const res = await POST(postReq({ orderId: "o1", paymentMethod: "CASH", cashReceived: 100000 }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.success).toBe(true)
  })

  it("berhasil membuat transaksi QRIS (tanpa cashReceived)", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "OPEN", transaction: null,
      items: [{ priceAtOrder: 35000, quantity: 2 }],
    })

    const mockTx = { id: "t2", totalAmount: 70000, paymentMethod: "QRIS" }
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.transaction.create.mockResolvedValue(mockTx)

    const res = await POST(postReq({ orderId: "o1", paymentMethod: "QRIS" }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.success).toBe(true)
  })
})
