import { POST, GET } from "@/app/api/orders/[id]/split-pay/route"

describe("API /orders/[id]/split-pay", () => {
  it("POST mengembalikan 501 — fitur belum tersedia", async () => {
    const res = await POST()
    expect(res.status).toBe(501)
    const data = await res.json()
    expect(data.success).toBe(false)
    expect(data.error).toContain("belum tersedia")
  })

  it("GET mengembalikan 501 — fitur belum tersedia", async () => {
    const res = await GET()
    expect(res.status).toBe(501)
    const data = await res.json()
    expect(data.success).toBe(false)
  })
})
