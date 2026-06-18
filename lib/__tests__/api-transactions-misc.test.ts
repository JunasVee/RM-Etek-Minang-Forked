jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET as GET_BY_ID } from "@/app/api/transactions/[id]/route"
import { GET as GET_SUMMARY } from "@/app/api/transactions/summary/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── GET /api/transactions/[id] ─────────────────────────────
describe("GET /api/transactions/[id]", () => {
  it("mengembalikan transaksi berdasarkan id", async () => {
    const tx = { id: "t1", totalAmount: 70000, order: {} }
    mockPrisma.transaction.findUnique.mockResolvedValue(tx)

    const req = new NextRequest("http://localhost/api/transactions/t1")
    const res = await GET_BY_ID(req, { params: { id: "t1" } } as any)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.id).toBe("t1")
  })

  it("mengembalikan 404 jika tidak ditemukan", async () => {
    mockPrisma.transaction.findUnique.mockResolvedValue(null)

    const req = new NextRequest("http://localhost/api/transactions/xxx")
    const res = await GET_BY_ID(req, { params: { id: "xxx" } } as any)
    expect(res.status).toBe(404)
  })
})

// ─── GET /api/transactions/summary ──────────────────────────
describe("GET /api/transactions/summary", () => {
  const aggResult = { _count: 10, _sum: { totalAmount: 500000 } }

  it("mengembalikan ringkasan transaksi", async () => {
    mockPrisma.transaction.aggregate.mockResolvedValue(aggResult)

    const req = new NextRequest("http://localhost/api/transactions/summary")
    const res = await GET_SUMMARY(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.totalCount).toBe(10)
    expect(data.data.totalRevenue).toBe(500000)
  })

  it("memfilter berdasarkan tanggal", async () => {
    mockPrisma.transaction.aggregate.mockResolvedValue(aggResult)

    const req = new NextRequest("http://localhost/api/transactions/summary?date=2025-06-18")
    await GET_SUMMARY(req)

    expect(mockPrisma.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paidAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    )
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.aggregate.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/transactions/summary")
    const res = await GET_SUMMARY(req)
    expect(res.status).toBe(500)
  })
})
