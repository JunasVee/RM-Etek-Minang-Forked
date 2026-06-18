jest.mock("@/lib/prisma")
jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}))

import { NextRequest } from "next/server"
import { PUT } from "@/app/api/orders/[id]/route"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const mockPrisma = prisma as any
const mockGetSession = getSession as jest.Mock

const mockParams = { params: { id: "order-1" } }

function putReq(body: object) {
  return new NextRequest("http://localhost/api/orders/order-1", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({
    userId: "u1",
    name: "Kasir",
    role: "KASIR",
    exp: 0,
  })
})

describe("PUT /api/orders/[id]", () => {
  it("mengembalikan 404 jika pesanan tidak ditemukan", async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const res = await PUT(
      putReq({ items: [{ menuItemId: "m1", quantity: 1 }] }),
      mockParams as any
    )
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toContain("tidak ditemukan")
  })

  it("mengembalikan 400 jika pesanan bukan OPEN", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      status: "PAID",
      items: [],
    })

    const res = await PUT(
      putReq({ items: [{ menuItemId: "m1", quantity: 1 }] }),
      mockParams as any
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain("tidak bisa diubah")
  })

  it("menolak non-OWNER yang menghapus item", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      status: "OPEN",
      items: [
        { menuItemId: "m1", quantity: 2 },
        { menuItemId: "m2", quantity: 1 },
      ],
    })

    const res = await PUT(
      putReq({ items: [{ menuItemId: "m1", quantity: 2 }] }),
      mockParams as any
    )
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toContain("persetujuan Owner")
  })

  it("menolak non-OWNER yang mengurangi quantity", async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      status: "OPEN",
      items: [{ menuItemId: "m1", quantity: 5 }],
    })

    const res = await PUT(
      putReq({ items: [{ menuItemId: "m1", quantity: 2 }] }),
      mockParams as any
    )
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toContain("persetujuan Owner")
  })

  it("OWNER boleh menghapus item", async () => {
    mockGetSession.mockResolvedValue({
      userId: "u1",
      name: "Owner",
      role: "OWNER",
      exp: 0,
    })

    const orderWithItems = {
      id: "order-1",
      status: "OPEN",
      items: [
        { menuItemId: "m1", quantity: 2 },
        { menuItemId: "m2", quantity: 1 },
      ],
    }

    mockPrisma.order.findUnique
      .mockResolvedValueOnce(orderWithItems)
      .mockResolvedValueOnce({ ...orderWithItems, items: [{ menuItemId: "m1", quantity: 2 }] })

    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: "m1", name: "Rendang", price: 35000, currentStock: 50, initialStock: 100, minThreshold: 0.25 },
      { id: "m2", name: "Es Teh", price: 5000, currentStock: 20, initialStock: 50, minThreshold: 0.25 },
    ])

    mockPrisma.menuItem.findUnique.mockResolvedValue({
      id: "m1", currentStock: 52, initialStock: 100,
    })

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
    mockPrisma.menuItem.update.mockResolvedValue({})
    mockPrisma.orderItem.deleteMany.mockResolvedValue({})
    mockPrisma.orderItem.create.mockResolvedValue({})
    mockPrisma.order.update.mockResolvedValue({})

    const res = await PUT(
      putReq({ items: [{ menuItemId: "m1", quantity: 2 }] }),
      mockParams as any
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
