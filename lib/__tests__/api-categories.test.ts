jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET, POST } from "@/app/api/categories/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/categories", () => {
  it("mengembalikan daftar kategori", async () => {
    const categories = [
      { id: "c1", name: "Makanan", sortOrder: 1, _count: { menuItems: 5 } },
      { id: "c2", name: "Minuman", sortOrder: 2, _count: { menuItems: 3 } },
    ]
    mockPrisma.category.findMany.mockResolvedValue(categories)

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toEqual(categories)
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { menuItems: true } } },
    })
  })

  it("mengembalikan 500 saat prisma error", async () => {
    mockPrisma.category.findMany.mockRejectedValue(new Error("DB error"))

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toContain("Gagal memuat kategori")
  })
})

describe("POST /api/categories", () => {
  it("membuat kategori baru", async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null)
    mockPrisma.category.findFirst.mockResolvedValue({ sortOrder: 2 })
    const created = { id: "c3", name: "Dessert", sortOrder: 3, _count: { menuItems: 0 } }
    mockPrisma.category.create.mockResolvedValue(created)

    const req = new NextRequest("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "Dessert" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.name).toBe("Dessert")
  })

  it("menolak nama kosong", async () => {
    const req = new NextRequest("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain("wajib diisi")
  })

  it("menolak nama duplikat", async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: "c1", name: "Makanan" })

    const req = new NextRequest("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "Makanan" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain("sudah ada")
  })

  it("auto-increment sortOrder jika tidak diberikan", async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null)
    mockPrisma.category.findFirst.mockResolvedValue({ sortOrder: 5 })
    mockPrisma.category.create.mockResolvedValue({
      id: "c4", name: "Snack", sortOrder: 6, _count: { menuItems: 0 },
    })

    const req = new NextRequest("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "Snack" }),
      headers: { "Content-Type": "application/json" },
    })
    await POST(req)

    expect(mockPrisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sortOrder: 6 }),
      })
    )
  })

  it("menggunakan sortOrder 1 jika belum ada kategori", async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null)
    mockPrisma.category.findFirst.mockResolvedValue(null)
    mockPrisma.category.create.mockResolvedValue({
      id: "c1", name: "Pertama", sortOrder: 1, _count: { menuItems: 0 },
    })

    const req = new NextRequest("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "Pertama" }),
      headers: { "Content-Type": "application/json" },
    })
    await POST(req)

    expect(mockPrisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sortOrder: 1 }),
      })
    )
  })
})
