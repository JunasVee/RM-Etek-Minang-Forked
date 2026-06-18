jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET as POS_INIT } from "@/app/api/pos/init/route"
import { GET as GET_SETTINGS, PUT as PUT_SETTINGS } from "@/app/api/settings/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── GET /api/pos/init ──────────────────────────────────────
describe("GET /api/pos/init", () => {
  it("mengembalikan data init POS", async () => {
    mockPrisma.category.findMany.mockResolvedValue([{ id: "c1", name: "Makanan" }])
    mockPrisma.menuItem.findMany.mockResolvedValue([{ id: "m1", name: "Rendang" }])
    mockPrisma.order.findMany.mockResolvedValue([])

    const res = await POS_INIT()
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.categories).toHaveLength(1)
    expect(data.data.menuItems).toHaveLength(1)
    expect(data.data.openOrders).toHaveLength(0)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.category.findMany.mockRejectedValue(new Error("DB"))

    const res = await POS_INIT()
    expect(res.status).toBe(500)
  })
})

// ─── GET/PUT /api/settings ──────────────────────────────────
describe("GET /api/settings", () => {
  it("mengembalikan pengaturan default", async () => {
    const res = await GET_SETTINGS()
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.restaurantName).toBeDefined()
  })
})

describe("PUT /api/settings", () => {
  it("berhasil mengupdate pengaturan", async () => {
    const req = new NextRequest("http://localhost/api/settings", {
      method: "PUT",
      body: JSON.stringify({ restaurantName: "RM. Baru" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PUT_SETTINGS(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.restaurantName).toBe("RM. Baru")
  })
})
