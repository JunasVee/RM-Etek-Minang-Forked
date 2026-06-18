import { GET, PUT } from "@/app/api/orders/[id]/split-plan/route"

describe("API /orders/[id]/split-plan", () => {
  it("GET mengembalikan data null (belum ada plan)", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data).toBeNull()
  })

  it("PUT mengembalikan 501 — fitur belum tersedia", async () => {
    const res = await PUT()
    expect(res.status).toBe(501)
    const data = await res.json()
    expect(data.success).toBe(false)
    expect(data.error).toContain("belum tersedia")
  })
})
