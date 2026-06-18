const mockFetch = jest.fn()
global.fetch = mockFetch as any

import { cachedFetch, invalidateCache } from "@/lib/cache"

beforeEach(() => {
  jest.clearAllMocks()
  invalidateCache()
})

describe("cachedFetch", () => {
  it("fetches data dan menyimpan cache", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ data: "hello" }) })

    const result = await cachedFetch("http://test.com/api", 5000)
    expect(result).toEqual({ data: "hello" })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("mengembalikan data dari cache jika belum expired", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ data: "first" }) })

    await cachedFetch("http://test.com/cached", 60000)
    const result = await cachedFetch("http://test.com/cached", 60000)

    expect(result).toEqual({ data: "first" })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("fetch ulang jika cache sudah expired", async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ data: "old" }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ data: "new" }) })

    await cachedFetch("http://test.com/expire", 1)
    await new Promise((r) => setTimeout(r, 10))
    const result = await cachedFetch("http://test.com/expire", 1)

    expect(result).toEqual({ data: "new" })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe("invalidateCache", () => {
  it("menghapus semua cache jika tanpa prefix", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ data: "x" }) })

    await cachedFetch("http://test.com/a", 60000)
    await cachedFetch("http://test.com/b", 60000)
    invalidateCache()

    await cachedFetch("http://test.com/a", 60000)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it("menghapus cache berdasarkan prefix", async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ data: "x" }) })

    await cachedFetch("http://test.com/api/users", 60000)
    await cachedFetch("http://test.com/api/orders", 60000)
    await cachedFetch("http://other.com/data", 60000)

    invalidateCache("http://test.com/api/")

    await cachedFetch("http://test.com/api/users", 60000)
    await cachedFetch("http://other.com/data", 60000)

    // users refetched (4th call), other.com still cached (no 5th call)
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })
})
