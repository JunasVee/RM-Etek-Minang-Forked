jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { PUT } from "@/app/api/users/[id]/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any
const params = { params: { id: "u1" } }

beforeEach(() => jest.clearAllMocks())

function putReq(body: object) {
  return new NextRequest("http://localhost/api/users/u1", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("PUT /api/users/[id]", () => {
  it("berhasil mengupdate nama", async () => {
    mockPrisma.user.update.mockResolvedValue({
      id: "u1", name: "Budi Baru", username: "budi", role: "CASHIER", isActive: true,
    })

    const res = await PUT(putReq({ name: "Budi Baru" }), params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.name).toBe("Budi Baru")
  })

  it("menolak username duplikat", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u2", username: "admin" })

    const res = await PUT(putReq({ username: "admin" }), params as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("sudah digunakan")
  })

  it("menolak PIN bukan 4 digit", async () => {
    const res = await PUT(putReq({ pin: "12" }), params as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("4 digit")
  })

  it("berhasil mengupdate PIN", async () => {
    mockPrisma.user.update.mockResolvedValue({
      id: "u1", name: "Budi", username: "budi", role: "CASHIER", isActive: true,
    })

    const res = await PUT(putReq({ pin: "9876" }), params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
  })

  it("berhasil mengupdate role dan status", async () => {
    mockPrisma.user.update.mockResolvedValue({
      id: "u1", name: "Budi", username: "budi", role: "OWNER", isActive: false,
    })

    const res = await PUT(putReq({ role: "OWNER", isActive: false }), params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.role).toBe("OWNER")
  })
})
