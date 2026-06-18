jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET as GET_NOTIF } from "@/app/api/notifications/route"
import { GET as GET_KITCHEN } from "@/app/api/kitchen/notifications/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── GET /api/notifications ─────────────────────────────────
describe("GET /api/notifications", () => {
  it("mengembalikan semua notifikasi", async () => {
    const notifs = [
      { id: "n1", menuItem: { name: "Rendang", currentStock: 2, initialStock: 20 } },
    ]
    mockPrisma.restockNotification.findMany.mockResolvedValue(notifs)

    const req = new NextRequest("http://localhost/api/notifications")
    const res = await GET_NOTIF(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toEqual(notifs)
  })

  it("memfilter notifikasi unresolved", async () => {
    mockPrisma.restockNotification.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/notifications?status=unresolved")
    await GET_NOTIF(req)

    expect(mockPrisma.restockNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isResolved: false },
      })
    )
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.restockNotification.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/notifications")
    const res = await GET_NOTIF(req)
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/kitchen/notifications ─────────────────────────
describe("GET /api/kitchen/notifications", () => {
  it("mengembalikan notifikasi dapur yang belum resolved", async () => {
    const notifs = [
      { id: "n1", menuItem: { id: "m1", name: "Rendang", currentStock: 2, initialStock: 20, minThreshold: 0.2, category: { name: "Makanan" } } },
    ]
    mockPrisma.restockNotification.findMany.mockResolvedValue(notifs)

    const res = await GET_KITCHEN()
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toEqual(notifs)
    expect(mockPrisma.restockNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isResolved: false } })
    )
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.restockNotification.findMany.mockRejectedValue(new Error("DB"))

    const res = await GET_KITCHEN()
    expect(res.status).toBe(500)
  })
})
