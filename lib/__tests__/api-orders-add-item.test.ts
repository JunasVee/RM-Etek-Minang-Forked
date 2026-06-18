jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { POST } from "@/app/api/orders/[id]/add-item/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any
const params = { params: { id: "o1" } }

beforeEach(() => jest.clearAllMocks())

function postReq(body: object) {
  return new NextRequest("http://localhost/api/orders/o1/add-item", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/orders/[id]/add-item", () => {
  it("menolak jika data tidak lengkap", async () => {
    const res = await POST(postReq({ menuItemId: "", quantity: 0 }), params as any)
    expect(res.status).toBe(400)
  })

  it("menolak jika pesanan tidak aktif", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: "o1", status: "PAID", items: [] })

    const res = await POST(postReq({ menuItemId: "m1", quantity: 1 }), params as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("tidak aktif")
  })

  it("menolak jika menu tidak ditemukan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: "o1", status: "OPEN", items: [] })
    mockPrisma.menuItem.findUnique.mockResolvedValue(null)

    const res = await POST(postReq({ menuItemId: "m1", quantity: 1 }), params as any)
    expect(res.status).toBe(400)
  })

  it("menolak jika stok tidak cukup", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({ id: "o1", status: "OPEN", items: [] })
    mockPrisma.menuItem.findUnique.mockResolvedValue({
      id: "m1", name: "Rendang", isActive: true, currentStock: 1, price: 25000,
    })

    const res = await POST(postReq({ menuItemId: "m1", quantity: 5 }), params as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Stok")
  })

  it("berhasil menambah item baru ke pesanan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "OPEN", items: [],
    })
    mockPrisma.menuItem.findUnique.mockResolvedValue({
      id: "m1", name: "Rendang", isActive: true, currentStock: 10, price: 25000,
    })
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
    mockPrisma.orderItem.create.mockResolvedValue({})
    mockPrisma.menuItem.update.mockResolvedValue({})

    const res = await POST(postReq({ menuItemId: "m1", quantity: 2 }), params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(mockPrisma.orderItem.create).toHaveBeenCalled()
  })

  it("mengupdate quantity jika item sudah ada", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "OPEN",
      items: [{ id: "oi1", menuItemId: "m1", quantity: 2 }],
    })
    mockPrisma.menuItem.findUnique.mockResolvedValue({
      id: "m1", name: "Rendang", isActive: true, currentStock: 10, price: 25000,
    })
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
    mockPrisma.orderItem.update.mockResolvedValue({})
    mockPrisma.menuItem.update.mockResolvedValue({})

    const res = await POST(postReq({ menuItemId: "m1", quantity: 3 }), params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(mockPrisma.orderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { quantity: 5 } })
    )
  })
})
