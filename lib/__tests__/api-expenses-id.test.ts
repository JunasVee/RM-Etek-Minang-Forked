jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { PUT, DELETE } from "@/app/api/expenses/[id]/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any
const params = { params: { id: "e1" } }

beforeEach(() => jest.clearAllMocks())

function putReq(body: object) {
  return new NextRequest("http://localhost/api/expenses/e1", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("PUT /api/expenses/[id]", () => {
  it("mengembalikan 404 jika tidak ditemukan", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue(null)

    const res = await PUT(putReq({ description: "Test", amount: 5000 }), params as any)
    expect(res.status).toBe(404)
  })

  it("menolak edit pengeluaran bukan hari ini", async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    mockPrisma.expense.findUnique.mockResolvedValue({ id: "e1", date: yesterday })

    const res = await PUT(putReq({ description: "Test", amount: 5000 }), params as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("hari ini")
  })

  it("menolak deskripsi kosong", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ id: "e1", date: new Date() })

    const res = await PUT(putReq({ description: "", amount: 5000 }), params as any)
    expect(res.status).toBe(400)
  })

  it("menolak jumlah invalid", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ id: "e1", date: new Date() })

    const res = await PUT(putReq({ description: "Bahan baku", amount: -100 }), params as any)
    expect(res.status).toBe(400)
  })

  it("berhasil mengupdate pengeluaran", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ id: "e1", date: new Date() })
    mockPrisma.expense.update.mockResolvedValue({
      id: "e1", description: "Gas LPG", amount: 18000,
    })

    const res = await PUT(putReq({ description: "Gas LPG", amount: 18000 }), params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.amount).toBe(18000)
  })
})

describe("DELETE /api/expenses/[id]", () => {
  it("mengembalikan 404 jika tidak ditemukan", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/expenses/e1", { method: "DELETE" })
    const res = await DELETE(req, params as any)
    expect(res.status).toBe(404)
  })

  it("menolak hapus pengeluaran bukan hari ini", async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    mockPrisma.expense.findUnique.mockResolvedValue({ id: "e1", date: yesterday })

    const req = new NextRequest("http://localhost/api/expenses/e1", { method: "DELETE" })
    const res = await DELETE(req, params as any)
    expect(res.status).toBe(400)
  })

  it("berhasil menghapus pengeluaran hari ini", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({ id: "e1", date: new Date() })
    mockPrisma.expense.delete.mockResolvedValue({})

    const req = new NextRequest("http://localhost/api/expenses/e1", { method: "DELETE" })
    const res = await DELETE(req, params as any)
    const data = await res.json()

    expect(data.success).toBe(true)
  })
})
