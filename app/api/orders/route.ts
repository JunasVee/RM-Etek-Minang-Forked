export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateOrderNumber } from "@/lib/utils"

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status")
    const dateParam = request.nextUrl.searchParams.get("date")
    const where: any = {}
    if (status) {
      if (status.includes(",")) where.status = { in: status.split(",") }
      else where.status = status
    }
    if (dateParam === "today") {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const end = new Date(); end.setHours(23, 59, 59, 999)
      where.createdAt = { gte: start, lte: end }
    }
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { menuItem: true } },
        createdBy: { select: { id: true, name: true } },
        transactions: true,
      },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ success: true, data: orders })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat pesanan" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { type, tableNumber, createdById, items } = await request.json()

    if (!type || !createdById || !items?.length) {
      return NextResponse.json({ success: false, error: "Data pesanan tidak lengkap" }, { status: 400 })
    }

    // Generate order number
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayCount = await prisma.order.count({ where: { createdAt: { gte: todayStart } } })
    const orderNumber = generateOrderNumber(todayCount + 1)

    // Fetch menu items
    const menuItemIds = items.map((i: any) => i.menuItemId)
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } })
    const menuMap = new Map(menuItems.map((m) => [m.id, m]))

    // Validate stock
    for (const item of items) {
      const menu = menuMap.get(item.menuItemId)
      if (!menu) return NextResponse.json({ success: false, error: "Menu tidak ditemukan" }, { status: 400 })
      if (menu.currentStock < item.quantity) {
        return NextResponse.json({ success: false, error: `Stok "${menu.name}" tidak cukup (sisa ${menu.currentStock})` }, { status: 400 })
      }
    }

    // Create order first (outside heavy transaction)
    const newOrder = await prisma.order.create({
      data: {
        orderNumber,
        type,
        tableNumber: tableNumber || null,
        createdById,
        items: {
          create: items.map((item: any) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            priceAtOrder: menuMap.get(item.menuItemId)!.price,
          })),
        },
      },
      include: {
        items: { include: { menuItem: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })

    // Bulk stock reduction with Promise.all (parallel)
    await Promise.all(items.map((item: any) => {
      const menu = menuMap.get(item.menuItemId)!
      return prisma.menuItem.update({
        where: { id: item.menuItemId },
        data: { currentStock: menu.currentStock - item.quantity },
      })
    }))

    // Bulk create stock logs
    await prisma.stockLog.createMany({
      data: items.map((item: any) => ({
        menuItemId: item.menuItemId,
        changeType: "SOLD" as const,
        quantity: -item.quantity,
        note: `Pesanan ${orderNumber}`,
      })),
    })

    // Check restock notifications (parallel)
    const hour = new Date().getHours()
    if (hour >= 8 && hour < 21) {
      const lowStockItems = items.filter((item: any) => {
        const menu = menuMap.get(item.menuItemId)!
        const newStock = menu.currentStock - item.quantity
        return newStock <= menu.initialStock * menu.minThreshold
      })

      if (lowStockItems.length > 0) {
        const existingNotifs = await prisma.restockNotification.findMany({
          where: {
            menuItemId: { in: lowStockItems.map((i: any) => i.menuItemId) },
            isResolved: false,
          },
          select: { menuItemId: true },
        })
        const existingSet = new Set(existingNotifs.map((n) => n.menuItemId))

        const newNotifs = lowStockItems
          .filter((item: any) => !existingSet.has(item.menuItemId))
          .map((item: any) => ({ menuItemId: item.menuItemId }))

        if (newNotifs.length > 0) {
          await prisma.restockNotification.createMany({ data: newNotifs })
        }
      }
    }

    return NextResponse.json({ success: true, data: newOrder }, { status: 201 })
  } catch (error) {
    console.error("Create order error:", error)
    return NextResponse.json({ success: false, error: "Gagal membuat pesanan" }, { status: 500 })
  }
}
