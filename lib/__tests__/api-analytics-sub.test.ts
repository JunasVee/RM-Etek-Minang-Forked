jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET as GET_DAY } from "@/app/api/analytics/day-of-week/route"
import { GET as GET_PEAK } from "@/app/api/analytics/peak-hours/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

const now = new Date("2025-06-18T12:00:00Z")
const txs = [
  { paidAt: now, totalAmount: 50000 },
  { paidAt: now, totalAmount: 30000 },
]

// ─── GET /api/analytics/day-of-week ─────────────────────────
describe("GET /api/analytics/day-of-week", () => {
  it("mengembalikan data per hari", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue(txs)

    const req = new NextRequest("http://localhost/api/analytics/day-of-week?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_DAY(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(7)
    expect(data.data[0].day).toBeDefined()
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/analytics/day-of-week?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_DAY(req)
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/analytics/peak-hours ──────────────────────────
describe("GET /api/analytics/peak-hours", () => {
  it("mengembalikan data jam sibuk", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue(txs)

    const req = new NextRequest("http://localhost/api/analytics/peak-hours?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_PEAK(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.length).toBeGreaterThan(0)
    expect(data.data[0].hour).toBeDefined()
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.transaction.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/analytics/peak-hours?startDate=2025-06-01&endDate=2025-06-18")
    const res = await GET_PEAK(req)
    expect(res.status).toBe(500)
  })
})
