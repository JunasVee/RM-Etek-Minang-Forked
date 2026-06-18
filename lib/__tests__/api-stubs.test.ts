import { GET as MOD_LIST } from "@/app/api/modification-requests/route"
import { PUT as MOD_APPROVE } from "@/app/api/modification-requests/[id]/approve/route"
import { PUT as MOD_REJECT } from "@/app/api/modification-requests/[id]/reject/route"

describe("Stub routes (fitur belum tersedia)", () => {
  it("GET /modification-requests → 501", async () => {
    const res = await MOD_LIST()
    expect(res.status).toBe(501)
    const data = await res.json()
    expect(data.success).toBe(false)
  })

  it("PUT /modification-requests/[id]/approve → 501", async () => {
    const res = await MOD_APPROVE()
    expect(res.status).toBe(501)
    const data = await res.json()
    expect(data.success).toBe(false)
  })

  it("PUT /modification-requests/[id]/reject → 501", async () => {
    const res = await MOD_REJECT()
    expect(res.status).toBe(501)
    const data = await res.json()
    expect(data.success).toBe(false)
  })
})
