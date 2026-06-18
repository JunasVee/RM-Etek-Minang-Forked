jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET, POST } from "@/app/api/users/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

describe("GET /api/users", () => {
  it("mengembalikan user aktif secara default", async () => {
    const users = [{ id: "u1", name: "Budi", role: "KASIR" }]
    mockPrisma.user.findMany.mockResolvedValue(users)

    const req = new NextRequest("http://localhost/api/users")
    const res = await GET(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toEqual(users)
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    )
  })

  it("mengembalikan semua user jika all=true", async () => {
    mockPrisma.user.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/users?all=true")
    await GET(req)

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/users")
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})

describe("POST /api/users", () => {
  function postReq(body: object) {
    return new NextRequest("http://localhost/api/users", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  const validBody = { name: "Siti", username: "siti", pin: "1234", role: "KASIR" }

  it("membuat user baru", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: "u2", ...validBody })

    const res = await POST(postReq(validBody))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.success).toBe(true)
  })

  it("menolak nama kosong", async () => {
    const res = await POST(postReq({ ...validBody, name: "" }))
    expect(res.status).toBe(400)
  })

  it("menolak username kosong", async () => {
    const res = await POST(postReq({ ...validBody, username: "" }))
    expect(res.status).toBe(400)
  })

  it("menolak PIN bukan 4 digit", async () => {
    const res = await POST(postReq({ ...validBody, pin: "12" }))
    expect(res.status).toBe(400)
  })

  it("menolak tanpa role", async () => {
    const res = await POST(postReq({ ...validBody, role: "" }))
    expect(res.status).toBe(400)
  })

  it("menolak username duplikat", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" })

    const res = await POST(postReq(validBody))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain("sudah digunakan")
  })
})
