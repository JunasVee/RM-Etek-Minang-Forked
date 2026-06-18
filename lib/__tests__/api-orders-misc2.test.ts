jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { PUT as REJECT } from "@/app/api/orders/[id]/reject/route"
import { GET as GET_STATUS } from "@/app/api/orders/[id]/status/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any
const params = { params: { id: "o1" } }

beforeEach(() => jest.clearAllMocks())

// ─── GET /api/orders/[id]/status ────────────────────────────
describe("GET /api/orders/[id]/status", () => {
  it("mengembalikan status pesanan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", orderNumber: "RM-001", status: "OPEN", tableNumber: 5,
      items: [{ quantity: 2, priceAtOrder: 25000, menuItem: { name: "Rendang" } }],
    })

    const req = new NextRequest("http://localhost/api/orders/o1/status")
    const res = await GET_STATUS(req, params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.status).toBe("OPEN")
  })

  it("mengembalikan 404 jika pesanan tidak ditemukan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/orders/o1/status")
    const res = await GET_STATUS(req, params as any)
    expect(res.status).toBe(404)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.order.findUnique.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/orders/o1/status")
    const res = await GET_STATUS(req, params as any)
    expect(res.status).toBe(500)
  })
})

// ─── PUT /api/orders/[id]/reject ────────────────────────────
describe("PUT /api/orders/[id]/reject", () => {
  function putReq(body: object) {
    return new NextRequest("http://localhost/api/orders/o1/reject", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("mengembalikan 404 jika pesanan tidak ditemukan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const res = await REJECT(putReq({ reason: "Habis" }), params as any)
    expect(res.status).toBe(404)
  })

  it("menolak jika status bukan PENDING_CONFIRMATION", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: "o1", status: "OPEN" })

    const res = await REJECT(putReq({ reason: "Habis" }), params as any)
    expect(res.status).toBe(400)
  })

  it("berhasil menolak pesanan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: "o1", status: "PENDING_CONFIRMATION" })
    mockPrisma.order.update.mockResolvedValue({})

    const res = await REJECT(putReq({ reason: "Menu habis" }), params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED", rejectReason: "Menu habis" }),
      })
    )
  })

  it("menggunakan alasan default jika tidak disediakan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: "o1", status: "PENDING_CONFIRMATION" })
    mockPrisma.order.update.mockResolvedValue({})

    const res = await REJECT(putReq({}), params as any)
    expect((await res.json()).success).toBe(true)
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rejectReason: "Ditolak oleh pelayan" }),
      })
    )
  })
})
