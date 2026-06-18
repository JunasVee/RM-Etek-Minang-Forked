jest.mock("@/lib/prisma")
jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}))

import { NextRequest } from "next/server"
import { PUT } from "@/app/api/orders/[id]/cancel/route"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const mockPrisma = prisma as any
const mockGetSession = getSession as jest.Mock
const params = { params: { id: "o1" } }

beforeEach(() => jest.clearAllMocks())

describe("PUT /api/orders/[id]/cancel", () => {
  it("mengembalikan 401 jika tidak login", async () => {
    mockGetSession.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/orders/o1/cancel", { method: "PUT" })
    const res = await PUT(req, params as any)
    expect(res.status).toBe(401)
  })

  it("mengembalikan 403 jika bukan OWNER", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", role: "CASHIER" })

    const req = new NextRequest("http://localhost/api/orders/o1/cancel", { method: "PUT" })
    const res = await PUT(req, params as any)
    expect(res.status).toBe(403)
  })

  it("mengembalikan 404 jika pesanan tidak ditemukan", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", role: "OWNER" })
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/orders/o1/cancel", { method: "PUT" })
    const res = await PUT(req, params as any)
    expect(res.status).toBe(404)
  })

  it("menolak jika status bukan OPEN", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", role: "OWNER" })
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "PAID", items: [],
    })

    const req = new NextRequest("http://localhost/api/orders/o1/cancel", { method: "PUT" })
    const res = await PUT(req, params as any)
    expect(res.status).toBe(400)
  })

  it("berhasil membatalkan pesanan dan mengembalikan stok", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", role: "OWNER" })
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "o1", status: "OPEN", orderNumber: "RM-001",
      items: [{ menuItemId: "m1", quantity: 3 }],
    })
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
    mockPrisma.menuItem.update.mockResolvedValue({})
    mockPrisma.stockLog.create.mockResolvedValue({})
    mockPrisma.order.update.mockResolvedValue({})

    const req = new NextRequest("http://localhost/api/orders/o1/cancel", { method: "PUT" })
    const res = await PUT(req, params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(mockPrisma.menuItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { currentStock: { increment: 3 } },
      })
    )
  })
})
