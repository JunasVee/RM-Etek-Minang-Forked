jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET } from "@/app/api/stock/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

describe("GET /api/stock", () => {
  it("mengembalikan stok item aktif", async () => {
    const items = [
      { id: "m1", name: "Rendang", currentStock: 20, initialStock: 100, category: { name: "Makanan" } },
    ]
    mockPrisma.menuItem.findMany.mockResolvedValue(items)

    const req = new NextRequest("http://localhost/api/stock")
    const res = await GET(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toEqual(items)
    expect(mockPrisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    )
  })

  it("memfilter berdasarkan categoryId", async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/stock?categoryId=c1")
    await GET(req)

    expect(mockPrisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true, categoryId: "c1" }),
      })
    )
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.menuItem.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/stock")
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})
