jest.mock("@/lib/prisma")

import { GET } from "@/app/api/dashboard/summary/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

describe("GET /api/dashboard/summary", () => {
  const aggRevenue = { _sum: { totalAmount: 500000 }, _count: 10 }
  const aggExpense = { _sum: { amount: 100000 }, _count: 3 }
  const aggYesterday = { _sum: { totalAmount: 400000 } }

  it("mengembalikan ringkasan dashboard", async () => {
    // Promise.all: [todayRevAgg, todayExpAgg, yesterdayRevAgg]
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce(aggRevenue)       // todayRevAgg
    mockPrisma.expense.aggregate
      .mockResolvedValueOnce(aggExpense)        // todayExpAgg
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce(aggYesterday)      // yesterdayRevAgg

    // Weekly loop: 7 iterations, each with Promise.all([rev, exp])
    for (let i = 0; i < 7; i++) {
      mockPrisma.transaction.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: 100000 } })
      mockPrisma.expense.aggregate.mockResolvedValueOnce({ _sum: { amount: 20000 } })
    }

    const res = await GET()
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.today.revenue).toBe(500000)
    expect(data.data.today.expenses).toBe(100000)
    expect(data.data.today.profit).toBe(400000)
    expect(data.data.today.count).toBe(10)
    expect(data.data.yesterdayRevenue).toBe(400000)
    expect(data.data.revChange).toBe(25)
    expect(data.data.weekly).toHaveLength(7)
  })

  it("mengembalikan revChange null jika kemarin 0", async () => {
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 100000 }, _count: 5 })
    mockPrisma.expense.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 0 }, _count: 0 })
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 0 } })

    for (let i = 0; i < 7; i++) {
      mockPrisma.transaction.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: 0 } })
      mockPrisma.expense.aggregate.mockResolvedValueOnce({ _sum: { amount: 0 } })
    }

    const res = await GET()
    const data = await res.json()

    expect(data.data.revChange).toBeNull()
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.aggregate.mockRejectedValue(new Error("DB"))

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
