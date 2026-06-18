jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { PUT, DELETE } from "@/app/api/categories/[id]/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any
const params = { params: { id: "c1" } }

beforeEach(() => jest.clearAllMocks())

describe("PUT /api/categories/[id]", () => {
  function putReq(body: object) {
    return new NextRequest("http://localhost/api/categories/c1", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("mengupdate kategori", async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null)
    mockPrisma.category.update.mockResolvedValue({
      id: "c1", name: "Makanan Berat", sortOrder: 1,
    })

    const res = await PUT(putReq({ name: "Makanan Berat", sortOrder: 1 }), params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
  })

  it("menolak nama kosong", async () => {
    const res = await PUT(putReq({ name: "" }), params as any)
    expect(res.status).toBe(400)
  })

  it("menolak nama duplikat", async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: "c2", name: "Minuman" })

    const res = await PUT(putReq({ name: "Minuman" }), params as any)
    expect(res.status).toBe(400)
  })
})

describe("DELETE /api/categories/[id]", () => {
  it("menghapus kategori tanpa menu", async () => {
    mockPrisma.menuItem.count.mockResolvedValue(0)
    mockPrisma.category.delete.mockResolvedValue({})

    const req = new NextRequest("http://localhost/api/categories/c1", { method: "DELETE" })
    const res = await DELETE(req, params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
  })

  it("menolak hapus kategori yang masih punya menu", async () => {
    mockPrisma.menuItem.count.mockResolvedValue(5)

    const req = new NextRequest("http://localhost/api/categories/c1", { method: "DELETE" })
    const res = await DELETE(req, params as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain("5 menu")
  })
})
