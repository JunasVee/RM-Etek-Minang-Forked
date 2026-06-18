jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { PUT } from "@/app/api/orders/[id]/confirm/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any
const params = { params: { id: "o1" } }

beforeEach(() => jest.clearAllMocks())

describe("PUT /api/orders/[id]/confirm", () => {
  it("mengembalikan 404 jika pesanan tidak ditemukan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/orders/o1/confirm", { method: "PUT" })
    const res = await PUT(req, params as any)
    expect(res.status).toBe(404)
  })

  it("menolak jika status bukan PENDING_CONFIRMATION", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "OPEN", items: [],
    })

    const req = new NextRequest("http://localhost/api/orders/o1/confirm", { method: "PUT" })
    const res = await PUT(req, params as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("sudah dikonfirmasi")
  })

  it("menolak jika stok tidak cukup", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "PENDING_CONFIRMATION",
      items: [{ menuItemId: "m1", quantity: 5 }],
    })
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: "m1", name: "Rendang", currentStock: 2, initialStock: 10, minThreshold: 0.2 },
    ])

    const req = new NextRequest("http://localhost/api/orders/o1/confirm", { method: "PUT" })
    const res = await PUT(req, params as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Stok")
  })

  it("berhasil mengkonfirmasi pesanan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "PENDING_CONFIRMATION", orderNumber: "RM-001",
      items: [{ menuItemId: "m1", quantity: 2 }],
    })
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: "m1", name: "Rendang", currentStock: 10, initialStock: 20, minThreshold: 0.2 },
    ])
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.menuItem.update.mockResolvedValue({})
    mockPrisma.stockLog.create.mockResolvedValue({})
    mockPrisma.restockNotification.findFirst.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/orders/o1/confirm", { method: "PUT" })
    const res = await PUT(req, params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "OPEN" } })
    )
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.order.findUnique.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/orders/o1/confirm", { method: "PUT" })
    const res = await PUT(req, params as any)
    expect(res.status).toBe(500)
  })
})
