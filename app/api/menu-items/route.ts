export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const categoryId = request.nextUrl.searchParams.get("categoryId")

    const where: any = {}
    if (categoryId) where.categoryId = categoryId

    const items = await prisma.menuItem.findMany({
      where,
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    })

    return NextResponse.json({ success: true, data: items })
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal memuat menu" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, categoryId, price, initialStock, minThreshold, isActive } = body

    // Validation
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Nama menu wajib diisi" },
        { status: 400 }
      )
    }
    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: "Kategori wajib dipilih" },
        { status: 400 }
      )
    }
    if (!price || price <= 0) {
      return NextResponse.json(
        { success: false, error: "Harga harus lebih dari 0" },
        { status: 400 }
      )
    }
    if (!initialStock || initialStock < 1) {
      return NextResponse.json(
        { success: false, error: "Stok awal minimal 1" },
        { status: 400 }
      )
    }

    // Unique name per category
    const duplicate = await prisma.menuItem.findFirst({
      where: { name: name.trim(), categoryId },
    })
    if (duplicate) {
      return NextResponse.json(
        { success: false, error: "Nama menu sudah ada di kategori ini" },
        { status: 400 }
      )
    }

    const item = await prisma.menuItem.create({
      data: {
        name: name.trim(),
        categoryId,
        price: Math.round(price),
        initialStock,
        currentStock: initialStock,
        minThreshold: minThreshold ?? 0.25,
        isActive: isActive ?? true,
      },
      include: { category: true },
    })

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal menambah menu" },
      { status: 500 }
    )
  }
}
