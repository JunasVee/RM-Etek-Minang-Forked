import { POST } from "@/app/api/orders/[id]/modification-request/route"

describe("POST /api/orders/[id]/modification-request", () => {
  it("mengembalikan 501 (belum tersedia)", async () => {
    const res = await POST()
    expect(res.status).toBe(501)
    const data = await res.json()
    expect(data.success).toBe(false)
  })
})
