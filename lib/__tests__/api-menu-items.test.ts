jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET, POST } from "@/app/api/menu-items/route"
import { PUT } from "@/app/api/menu-items/[id]/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── GET /api/menu-items ───────────────────────────────────
describe("GET /api/menu-items", () => {
  it("mengembalikan semua menu items", async () => {
    const items = [{ id: "m1", name: "Rendang", price: 35000 }]
    mockPrisma.menuItem.findMany.mockResolvedValue(items)

    const req = new NextRequest("http://localhost/api/menu-items")
    const res = await GET(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toEqual(items)
  })

  it("memfilter berdasarkan categoryId", async () => {
    mockPrisma.menuItem.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/menu-items?categoryId=c1")
    await GET(req)

    expect(mockPrisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { categoryId: "c1" } })
    )
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.menuItem.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/menu-items")
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})

// ─── POST /api/menu-items ──────────────────────────────────
describe("POST /api/menu-items", () => {
  function postReq(body: object) {
    return new NextRequest("http://localhost/api/menu-items", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  const validBody = {
    name: "Sate Padang",
    categoryId: "c1",
    price: 25000,
    initialStock: 50,
  }

  it("membuat menu item baru", async () => {
    mockPrisma.menuItem.findFirst.mockResolvedValue(null)
    mockPrisma.menuItem.create.mockResolvedValue({ id: "m2", ...validBody })

    const res = await POST(postReq(validBody))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.success).toBe(true)
  })

  it("menolak nama kosong", async () => {
    const res = await POST(postReq({ ...validBody, name: "" }))
    expect(res.status).toBe(400)
  })

  it("menolak tanpa kategori", async () => {
    const res = await POST(postReq({ ...validBody, categoryId: "" }))
    expect(res.status).toBe(400)
  })

  it("menolak harga nol", async () => {
    const res = await POST(postReq({ ...validBody, price: 0 }))
    expect(res.status).toBe(400)
  })

  it("menolak stok awal kurang dari 1", async () => {
    const res = await POST(postReq({ ...validBody, initialStock: 0 }))
    expect(res.status).toBe(400)
  })

  it("menolak nama duplikat dalam kategori yang sama", async () => {
    mockPrisma.menuItem.findFirst.mockResolvedValue({ id: "m1" })

    const res = await POST(postReq(validBody))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain("sudah ada")
  })
})

// ─── PUT /api/menu-items/[id] ──────────────────────────────
describe("PUT /api/menu-items/[id]", () => {
  const params = { params: { id: "m1" } }

  function putReq(body: object) {
    return new NextRequest("http://localhost/api/menu-items/m1", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("mengupdate menu item", async () => {
    mockPrisma.menuItem.findFirst.mockResolvedValue(null)
    mockPrisma.menuItem.update.mockResolvedValue({ id: "m1", name: "Rendang Spesial" })

    const res = await PUT(putReq({ name: "Rendang Spesial", categoryId: "c1" }), params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
  })

  it("menolak nama kosong", async () => {
    const res = await PUT(putReq({ name: "" }), params as any)
    expect(res.status).toBe(400)
  })

  it("menolak harga negatif", async () => {
    const res = await PUT(putReq({ price: -100 }), params as any)
    expect(res.status).toBe(400)
  })

  it("menolak nama duplikat", async () => {
    mockPrisma.menuItem.findFirst.mockResolvedValue({ id: "m2" })

    const res = await PUT(putReq({ name: "Rendang", categoryId: "c1" }), params as any)
    expect(res.status).toBe(400)
  })
})
