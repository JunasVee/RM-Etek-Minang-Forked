jest.mock("@/lib/prisma")

import { NextRequest } from "next/server"
import { GET as GET_LOGS } from "@/app/api/stock/logs/route"
import { GET as GET_PUBLIC } from "@/app/api/menu/public/route"
import { POST as UPLOAD } from "@/app/api/upload/route"
import { prisma } from "@/lib/prisma"

const mockPrisma = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── GET /api/stock/logs ────────────────────────────────────
describe("GET /api/stock/logs", () => {
  it("mengembalikan semua log stok", async () => {
    mockPrisma.stockLog.findMany.mockResolvedValue([
      { id: "l1", changeType: "SOLD", menuItem: { name: "Rendang" } },
    ])

    const req = new NextRequest("http://localhost/api/stock/logs")
    const res = await GET_LOGS(req)
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(1)
  })

  it("memfilter log hari ini", async () => {
    mockPrisma.stockLog.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/stock/logs?date=today")
    await GET_LOGS(req)

    expect(mockPrisma.stockLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      })
    )
  })

  it("memfilter berdasarkan menuItemId", async () => {
    mockPrisma.stockLog.findMany.mockResolvedValue([])

    const req = new NextRequest("http://localhost/api/stock/logs?menuItemId=m1")
    await GET_LOGS(req)

    expect(mockPrisma.stockLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ menuItemId: "m1" }),
      })
    )
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.stockLog.findMany.mockRejectedValue(new Error("DB"))

    const req = new NextRequest("http://localhost/api/stock/logs")
    const res = await GET_LOGS(req)
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/menu/public ───────────────────────────────────
describe("GET /api/menu/public", () => {
  it("mengembalikan menu publik", async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      { id: "c1", name: "Makanan", menuItems: [{ id: "m1", name: "Rendang" }] },
    ])

    const res = await GET_PUBLIC()
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(1)
  })

  it("mengembalikan 500 saat error", async () => {
    mockPrisma.category.findMany.mockRejectedValue(new Error("DB"))

    const res = await GET_PUBLIC()
    expect(res.status).toBe(500)
  })
})

// ─── POST /api/upload ───────────────────────────────────────
describe("POST /api/upload", () => {
  function postReq(body: object) {
    return new NextRequest("http://localhost/api/upload", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("menolak jika data tidak lengkap", async () => {
    const res = await UPLOAD(postReq({ menuItemId: "", imageData: "" }))
    expect(res.status).toBe(400)
  })

  it("menolak format gambar tidak valid", async () => {
    const res = await UPLOAD(postReq({ menuItemId: "m1", imageData: "not-image" }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Format")
  })

  it("menolak ukuran terlalu besar", async () => {
    const bigData = "data:image/png;base64," + "A".repeat(700001)
    const res = await UPLOAD(postReq({ menuItemId: "m1", imageData: bigData }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("terlalu besar")
  })

  it("berhasil upload gambar", async () => {
    const imageData = "data:image/png;base64,iVBOR"
    mockPrisma.menuItem.update.mockResolvedValue({ id: "m1", imageUrl: imageData })

    const res = await UPLOAD(postReq({ menuItemId: "m1", imageData }))
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.imageUrl).toBe(imageData)
  })
})
