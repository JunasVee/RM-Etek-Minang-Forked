export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const status = sp.get("status")
    const date = sp.get("date")

    const where: any = {}
    if (status && status !== "all") where.status = status
    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0)
      const end = new Date(date); end.setHours(23, 59, 59, 999)
      where.createdAt = { gte: start, lte: end }
    }

    const requests = await prisma.orderModificationRequest.findMany({
      where,
      include: {
        order: { select: { orderNumber: true, tableNumber: true, items: { include: { menuItem: { select: { name: true } } } } } },
        requestedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const pendingCount = await prisma.orderModificationRequest.count({ where: { status: "PENDING" } })

    return NextResponse.json({ success: true, data: requests, pendingCount })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 })
  }
}
