import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { menuItemId, quantity } = await request.json()
    if (!menuItemId || !quantity || quantity < 1) {
      return NextResponse.json({ success: false, error: "Data tidak lengkap" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({ where: { id: params.id }, include: { items: true } })
    if (!order || (order.status !== "OPEN" && order.status !== "PARTIALLY_PAID")) {
      return NextResponse.json({ success: false, error: "Pesanan tidak aktif" }, { status: 400 })
    }

    const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } })
    if (!menuItem || !menuItem.isActive) {
      return NextResponse.json({ success: false, error: "Menu tidak ditemukan" }, { status: 400 })
    }
    if (menuItem.currentStock < quantity) {
      return NextResponse.json({ success: false, error: `Stok "${menuItem.name}" tidak cukup` }, { status: 400 })
    }

    // Check if item already exists in order
    const existingItem = order.items.find((i) => i.menuItemId === menuItemId)

    await prisma.$transaction(async (tx) => {
      if (existingItem) {
        await tx.orderItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + quantity },
        })
      } else {
        await tx.orderItem.create({
          data: { orderId: params.id, menuItemId, quantity, priceAtOrder: menuItem.price },
        })
      }
      await tx.menuItem.update({
        where: { id: menuItemId },
        data: { currentStock: { decrement: quantity } },
      })
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal menambah item" }, { status: 500 })
  }
}
