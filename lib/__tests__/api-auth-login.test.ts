jest.mock("@/lib/prisma")
jest.mock("@/lib/auth", () => ({
  createSession: jest.fn().mockResolvedValue("mock-token"),
  getRoleRedirect: jest.fn().mockImplementation((role: string) => {
    switch (role) {
      case "WAITER":
      case "KASIR":
        return "/pos"
      case "DAPUR":
        return "/kitchen"
      case "OWNER":
        return "/dashboard"
      default:
        return "/login"
    }
  }),
}))

import { NextRequest } from "next/server"
import { POST } from "@/app/api/auth/login/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

function loginReq(body: object) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("POST /api/auth/login", () => {
  const mockUser = {
    id: "user-1",
    name: "Budi",
    role: "KASIR",
    pin: "1234",
    isActive: true,
  }

  it("login berhasil dengan userId dan pin yang benar", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser)

    const res = await POST(loginReq({ userId: "user-1", pin: "1234" }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.name).toBe("Budi")
    expect(data.data.role).toBe("KASIR")
    expect(data.data.redirect).toBe("/pos")
  })

  it("menolak jika userId atau pin kosong", async () => {
    const res = await POST(loginReq({ userId: "", pin: "" }))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toContain("Pilih pengguna")
  })

  it("mengembalikan 404 jika user tidak ditemukan", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const res = await POST(loginReq({ userId: "unknown", pin: "1234" }))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toContain("tidak ditemukan")
  })

  it("mengembalikan 401 jika PIN salah", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUser)

    const res = await POST(loginReq({ userId: "user-1", pin: "9999" }))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toContain("PIN salah")
  })

  it("redirect OWNER ke /dashboard", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, role: "OWNER" })

    const res = await POST(loginReq({ userId: "user-1", pin: "1234" }))
    const data = await res.json()

    expect(data.data.redirect).toBe("/dashboard")
  })

  it("redirect DAPUR ke /kitchen", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, role: "DAPUR" })

    const res = await POST(loginReq({ userId: "user-1", pin: "1234" }))
    const data = await res.json()

    expect(data.data.redirect).toBe("/kitchen")
  })

  it("redirect WAITER ke /pos", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, role: "WAITER" })

    const res = await POST(loginReq({ userId: "user-1", pin: "1234" }))
    const data = await res.json()

    expect(data.data.redirect).toBe("/pos")
  })
})
