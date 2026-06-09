export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status")

    const where: any = {}
    if (status === "unresolved") {
      where.isResolved = false
    }

    const notifications = await prisma.restockNotification.findMany({
      where,
      include: {
        menuItem: {
          select: { name: true, currentStock: true, initialStock: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: notifications })
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal memuat notifikasi" },
      { status: 500 }
    )
  }
}
