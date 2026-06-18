jest.mock("@/lib/prisma")
jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}))

import { NextRequest } from "next/server"
import { GET, POST } from "@/app/api/expenses/route"
import { GET as GET_TOTAL } from "@/app/api/expenses/total/route"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

const mockPrisma = prisma as any
const mockGetSession = getSession as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({ userId: "u1", name: "Kasir", role: "KASIR", exp: 0 })
})

// ─── GET /api/expenses ──────────────────────────────────────
describe("GET /api/expenses", () => {
  it("mengembalikan semua pengeluaran", async () => {
    const expenses = [{ id: "e1", description: "Bahan baku", amount: 50000 }]
    mockPrisma.expense.findMany.mockResolvedValue(expenses)

    const req = new NextRequest("http://localhost/api/expenses")
    const res = await GET(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toEqual(expenses)
  })

  it("memfilter berdasarkan tanggal", async () => {
    mockPrisma.expense.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/expenses?date=2025-06-18")
    await GET(req)

    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      })
    )
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.expense.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/expenses")
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})

// ─── POST /api/expenses ─────────────────────────────────────
describe("POST /api/expenses", () => {
  function postReq(body: object) {
    return new NextRequest("http://localhost/api/expenses", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("menolak jika tidak terautentikasi", async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await POST(postReq({ description: "Test", amount: 10000 }))
    expect(res.status).toBe(401)
  })

  it("menolak deskripsi kosong", async () => {
    const res = await POST(postReq({ description: "", amount: 10000 }))
    expect(res.status).toBe(400)
  })

  it("menolak amount nol", async () => {
    const res = await POST(postReq({ description: "Bahan baku", amount: 0 }))
    expect(res.status).toBe(400)
  })

  it("membuat pengeluaran baru", async () => {
    mockPrisma.expense.create.mockResolvedValue({
      id: "e1", description: "Bahan baku", amount: 50000,
    })

    const res = await POST(postReq({ description: "Bahan baku", amount: 50000, date: "2025-06-18" }))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.success).toBe(true)
  })
})

// ─── GET /api/expenses/total ────────────────────────────────
describe("GET /api/expenses/total", () => {
  it("mengembalikan total pengeluaran", async () => {
    mockPrisma.expense.aggregate.mockResolvedValue({
      _count: 5,
      _sum: { amount: 250000 },
    })

    const req = new NextRequest("http://localhost/api/expenses/total")
    const res = await GET_TOTAL(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.count).toBe(5)
    expect(data.data.total).toBe(250000)
  })

  it("memfilter berdasarkan tanggal", async () => {
    mockPrisma.expense.aggregate.mockResolvedValue({ _count: 0, _sum: { amount: null } })

    const req = new NextRequest("http://localhost/api/expenses/total?date=2025-06-18")
    const res = await GET_TOTAL(req)
    const data = await res.json()

    expect(data.data.total).toBe(0)
  })
})
