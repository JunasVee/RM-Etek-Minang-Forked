jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { POST } from "@/app/api/orders/online/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any
let testIp = 0

beforeEach(() => {
  jest.clearAllMocks()
  testIp++
})

function postReq(body: object) {
  return new NextRequest("http://localhost/api/orders/online", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${testIp}` },
  })
}

describe("POST /api/orders/online", () => {
  it("menolak jika data tidak lengkap", async () => {
    const res = await POST(postReq({ tableNumber: null, items: [] }))
    expect(res.status).toBe(400)
  })

  it("menolak nomor meja tidak valid (> 100)", async () => {
    const res = await POST(postReq({ tableNumber: 101, items: [{ menuItemId: "m1", quantity: 1 }] }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Nomor meja")
  })

  it("menolak jika lebih dari 20 item", async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({ menuItemId: `m${i}`, quantity: 1 }))
    const res = await POST(postReq({ tableNumber: 1, items }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("20 item")
  })

  it("menolak jika menu tidak ditemukan", async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([])

    const res = await POST(postReq({ tableNumber: 5, items: [{ menuItemId: "m1", quantity: 1 }] }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Menu tidak ditemukan")
  })

  it("menolak jika stok tidak cukup", async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: "m1", name: "Rendang", currentStock: 2, isActive: true, price: 25000 },
    ])

    const res = await POST(postReq({ tableNumber: 5, items: [{ menuItemId: "m1", quantity: 5 }] }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Stok")
  })

  it("berhasil membuat pesanan online", async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([
      { id: "m1", name: "Rendang", currentStock: 10, isActive: true, price: 25000 },
    ])
    mockPrisma.order.count.mockResolvedValue(5)
    mockPrisma.order.create.mockResolvedValue({
      id: "o1", orderNumber: "RM-006", status: "PENDING_CONFIRMATION",
      items: [{ menuItemId: "m1", quantity: 2, priceAtOrder: 25000 }],
    })

    const res = await POST(postReq({ tableNumber: 5, items: [{ menuItemId: "m1", quantity: 2 }] }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.status).toBe("PENDING_CONFIRMATION")
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.menuItem.findMany.mockRejectedValue(new Error("DB"))

    const res = await POST(postReq({ tableNumber: 5, items: [{ menuItemId: "m1", quantity: 1 }] }))
    expect(res.status).toBe(500)
  })
})
