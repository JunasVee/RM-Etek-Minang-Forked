jest.mock("@/lib/prisma")
jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}))

import { NextRequest } from "next/server"
import { POST } from "@/app/api/transactions/[id]/void/route"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const mockPrisma = prisma as any
const mockGetSession = getSession as jest.Mock
const params = { params: { id: "t1" } }

beforeEach(() => jest.clearAllMocks())

function postReq(body: object) {
  return new NextRequest("http://localhost/api/transactions/t1/void", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/transactions/[id]/void", () => {
  it("mengembalikan 403 jika bukan OWNER", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", role: "CASHIER" })

    const res = await POST(postReq({ reason: "Salah input" }), params as any)
    expect(res.status).toBe(403)
  })

  it("mengembalikan 403 jika tidak login", async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await POST(postReq({ reason: "Salah input" }), params as any)
    expect(res.status).toBe(403)
  })

  it("menolak jika alasan kosong", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", role: "OWNER" })

    const res = await POST(postReq({ reason: "" }), params as any)
    expect(res.status).toBe(400)
  })

  it("mengembalikan 404 jika transaksi tidak ditemukan", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", role: "OWNER" })
    mockPrisma.transaction.findUnique.mockResolvedValue(null)

    const res = await POST(postReq({ reason: "Salah input" }), params as any)
    expect(res.status).toBe(404)
  })

  it("menolak void transaksi bukan hari ini", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", role: "OWNER" })
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    mockPrisma.transaction.findUnique.mockResolvedValue({
      id: "t1", paidAt: yesterday, orderId: "o1",
      order: { status: "PAID", orderNumber: "RM-001", items: [] },
    })

    const res = await POST(postReq({ reason: "Salah input" }), params as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("hari ini")
  })

  it("menolak void transaksi yang sudah dibatalkan", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", role: "OWNER" })
    mockPrisma.transaction.findUnique.mockResolvedValue({
      id: "t1", paidAt: new Date(), orderId: "o1",
      order: { status: "CANCELLED", orderNumber: "RM-001", items: [] },
    })

    const res = await POST(postReq({ reason: "Salah input" }), params as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("sudah dibatalkan")
  })

  it("berhasil void transaksi dan mengembalikan stok", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", role: "OWNER" })
    mockPrisma.transaction.findUnique.mockResolvedValue({
      id: "t1", paidAt: new Date(), orderId: "o1",
      order: {
        status: "PAID", orderNumber: "RM-001",
        items: [{ menuItemId: "m1", quantity: 2 }],
      },
    })
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
    mockPrisma.menuItem.update.mockResolvedValue({})
    mockPrisma.stockLog.create.mockResolvedValue({})
    mockPrisma.order.update.mockResolvedValue({})
    mockPrisma.transaction.delete.mockResolvedValue({})

    const res = await POST(postReq({ reason: "Salah input" }), params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(mockPrisma.menuItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { currentStock: { increment: 2 } },
      })
    )
    expect(mockPrisma.transaction.delete).toHaveBeenCalled()
  })
})
