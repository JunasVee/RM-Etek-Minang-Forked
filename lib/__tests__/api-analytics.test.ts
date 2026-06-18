jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET as GET_REVENUE } from "@/app/api/analytics/revenue/route"
import { GET as GET_PROFIT } from "@/app/api/analytics/profit/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── GET /api/analytics/revenue ─────────────────────────────
describe("GET /api/analytics/revenue", () => {
  it("mengembalikan data revenue dengan breakdown", async () => {
    const mockTxs = [
      {
        totalAmount: 50000, paymentMethod: "CASH",
        paidAt: new Date("2025-06-18T10:00:00"),
        order: { type: "DINE_IN", source: null },
      },
      {
        totalAmount: 30000, paymentMethod: "QRIS",
        paidAt: new Date("2025-06-18T12:00:00"),
        order: { type: "TAKEAWAY", source: "ONLINE" },
      },
    ]
    mockPrisma.transaction.findMany.mockResolvedValue(mockTxs)

    const req = new NextRequest("http://localhost/api/analytics/revenue?startDate=2025-06-18&endDate=2025-06-18")
    const res = await GET_REVENUE(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.totalRevenue).toBe(80000)
    expect(data.data.totalCount).toBe(2)
    expect(data.data.byMethod.cash.revenue).toBe(50000)
    expect(data.data.byMethod.qris.revenue).toBe(30000)
    expect(data.data.byType.dineIn.count).toBe(1)
    expect(data.data.byType.takeaway.count).toBe(1)
    expect(data.data.byType.online.count).toBe(1)
  })

  it("mengembalikan 0 tanpa transaksi", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/analytics/revenue?startDate=2025-06-18&endDate=2025-06-18")
    const res = await GET_REVENUE(req)
    const data = await res.json()

    expect(data.data.totalRevenue).toBe(0)
    expect(data.data.avgTransactionValue).toBe(0)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/analytics/revenue")
    const res = await GET_REVENUE(req)
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/analytics/profit ──────────────────────────────
describe("GET /api/analytics/profit", () => {
  it("menghitung profit = revenue - expenses", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      { totalAmount: 100000, paidAt: new Date("2025-06-18T10:00:00") },
      { totalAmount: 50000, paidAt: new Date("2025-06-18T14:00:00") },
    ])
    mockPrisma.expense.findMany.mockResolvedValue([
      { amount: 30000, date: new Date("2025-06-18T08:00:00"), description: "Bahan baku" },
    ])
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { totalAmount: 120000 } })
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 25000 } })

    const req = new NextRequest("http://localhost/api/analytics/profit?startDate=2025-06-18&endDate=2025-06-18")
    const res = await GET_PROFIT(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.totalRevenue).toBe(150000)
    expect(data.data.totalExpenses).toBe(30000)
    expect(data.data.profit).toBe(120000)
    expect(data.data.margin).toBe(80)
  })

  it("mengkategorikan pengeluaran berdasarkan deskripsi", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      { totalAmount: 200000, paidAt: new Date("2025-06-18") },
    ])
    mockPrisma.expense.findMany.mockResolvedValue([
      { amount: 50000, date: new Date("2025-06-18"), description: "Bahan baku sayur" },
      { amount: 20000, date: new Date("2025-06-18"), description: "Gas LPG" },
      { amount: 10000, date: new Date("2025-06-18"), description: "Perlengkapan" },
      { amount: 15000, date: new Date("2025-06-18"), description: "Listrik" },
      { amount: 8000, date: new Date("2025-06-18"), description: "Es batu" },
      { amount: 5000, date: new Date("2025-06-18"), description: "Lain-lain" },
    ])
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } })

    const req = new NextRequest("http://localhost/api/analytics/profit?startDate=2025-06-18&endDate=2025-06-18")
    const res = await GET_PROFIT(req)
    const data = await res.json()

    const catNames = data.data.expenseCategories.map((c: any) => c.name)
    expect(catNames).toContain("Bahan Baku")
    expect(catNames).toContain("Gas LPG")
    expect(catNames).toContain("Perlengkapan")
    expect(catNames).toContain("Listrik")
    expect(catNames).toContain("Es Batu")
    expect(catNames).toContain("Lainnya")
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/analytics/profit")
    const res = await GET_PROFIT(req)
    expect(res.status).toBe(500)
  })
})
