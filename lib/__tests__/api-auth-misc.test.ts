jest.mock("@/lib/auth", () => ({
  destroySession: jest.fn().mockResolvedValue(undefined),
  getSession: jest.fn(),
}))

import { POST as LOGOUT } from "@/app/api/auth/logout/route"
import { GET as ME } from "@/app/api/auth/me/route"
import { getSession } from "@/lib/auth"

const mockGetSession = getSession as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe("POST /api/auth/logout", () => {
  it("berhasil logout", async () => {
    const res = await LOGOUT()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })
})

describe("GET /api/auth/me", () => {
  it("mengembalikan session jika terautentikasi", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", name: "Budi", role: "KASIR" })

    const res = await ME()
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.data.name).toBe("Budi")
  })

  it("mengembalikan 401 jika tidak terautentikasi", async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await ME()
    expect(res.status).toBe(401)
  })
})
