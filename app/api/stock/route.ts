export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const categoryId = request.nextUrl.searchParams.get("categoryId")

    const where: any = { isActive: true }
    if (categoryId) where.categoryId = categoryId

    const items = await prisma.menuItem.findMany({
      where,
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    })

    return NextResponse.json({ success: true, data: items })
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal memuat data stok" },
      { status: 500 }
    )
  }
}
