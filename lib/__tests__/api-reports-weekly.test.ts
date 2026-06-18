jest.mock("@/lib/prisma")

import { GET } from "@/app/api/reports/weekly/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

describe("GET /api/reports/weekly", () => {
  it("mengembalikan data 7 hari", async () => {
    for (let i = 0; i < 7; i++) {
      mockPrisma.transaction.aggregate.mockResolvedValueOnce({
        _count: 10, _sum: { totalAmount: 100000 },
      })
    }

    const res = await GET()
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(7)
    expect(data.data[0].revenue).toBe(100000)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.aggregate.mockRejectedValue(new Error("DB"))

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
