jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { PUT } from "@/app/api/stock/[menuItemId]/route"
import { POST as RESET } from "@/app/api/stock/reset/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── PUT /api/stock/[menuItemId] ────────────────────────────
describe("PUT /api/stock/[menuItemId]", () => {
  const params = { params: { menuItemId: "m1" } }

  function putReq(body: object) {
    return new NextRequest("http://localhost/api/stock/m1", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("menolak quantity kurang dari 1", async () => {
    const res = await PUT(putReq({ quantity: 0 }), params as any)
    expect(res.status).toBe(400)
  })

  it("mengembalikan 404 jika menu tidak ditemukan", async () => {
    mockPrisma.menuItem.findUnique.mockResolvedValue(null)

    const res = await PUT(putReq({ quantity: 5 }), params as any)
    expect(res.status).toBe(404)
  })

  it("berhasil menambah stok", async () => {
    mockPrisma.menuItem.findUnique.mockResolvedValue({ id: "m1", currentStock: 10 })
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
    mockPrisma.menuItem.update.mockResolvedValue({ id: "m1", currentStock: 15, category: { name: "Makanan" } })
    mockPrisma.stockLog.create.mockResolvedValue({})
    mockPrisma.restockNotification.updateMany.mockResolvedValue({})

    const res = await PUT(putReq({ quantity: 5, note: "Tambah dari dapur" }), params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(mockPrisma.menuItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { currentStock: { increment: 5 } },
      })
    )
  })
})

// ─── POST /api/stock/reset ──────────────────────────────────
describe("POST /api/stock/reset", () => {
  function postReq(body: object) {
    return new NextRequest("http://localhost/api/stock/reset", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("menolak jika data tidak valid", async () => {
    const res = await RESET(postReq({ items: "bukan array" }))
    expect(res.status).toBe(400)
  })

  it("berhasil reset stok harian", async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: "m1", currentStock: 5, initialStock: 20 },
      { id: "m2", currentStock: 0, initialStock: 15 },
    ])
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
    mockPrisma.menuItem.update.mockResolvedValue({})
    mockPrisma.stockLog.create.mockResolvedValue({})
    mockPrisma.restockNotification.updateMany.mockResolvedValue({})

    const res = await RESET(postReq({
      items: [
        { menuItemId: "m1", stock: 30 },
        { menuItemId: "m2", stock: 0 },
      ],
    }))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.totalItems).toBe(2)
    expect(data.data.activeItems).toBe(1)
  })
})
