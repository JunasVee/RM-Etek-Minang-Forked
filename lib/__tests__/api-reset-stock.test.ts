jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { POST } from "@/app/api/menu-items/reset-stock/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

function postReq(body: object) {
  return new NextRequest("http://localhost/api/menu-items/reset-stock", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/menu-items/reset-stock", () => {
  it("menolak jika data tidak valid", async () => {
    const res = await POST(postReq({ items: "bukan array" }))
    expect(res.status).toBe(400)
  })

  it("berhasil reset stok menu items", async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: "m1", currentStock: 5, initialStock: 20 },
      { id: "m2", currentStock: 3, initialStock: 15 },
    ])
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
    mockPrisma.menuItem.update.mockResolvedValue({})
    mockPrisma.stockLog.create.mockResolvedValue({})
    mockPrisma.restockNotification.updateMany.mockResolvedValue({})

    const res = await POST(postReq({
      items: [
        { menuItemId: "m1", stock: 25 },
        { menuItemId: "m2", stock: 0 },
      ],
    }))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.totalItems).toBe(2)
    expect(data.data.activeItems).toBe(1)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.menuItem.findMany.mockRejectedValue(new Error("DB"))

    const res = await POST(postReq({ items: [{ menuItemId: "m1", stock: 10 }] }))
    expect(res.status).toBe(500)
  })
})
