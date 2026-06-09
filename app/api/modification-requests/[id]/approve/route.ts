import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { reviewedById, reviewNote } = await request.json()

    const modReq = await prisma.orderModificationRequest.findUnique({
      where: { id: params.id },
      include: { order: { include: { items: true } } },
    })
    if (!modReq || modReq.status !== "PENDING") {
      return NextResponse.json({ success: false, error: "Permintaan tidak ditemukan" }, { status: 404 })
    }

    const details = JSON.parse(modReq.details)

    await prisma.$transaction(async (tx) => {
      // Apply the change
      if (modReq.type === "CANCEL_ORDER") {
        // Restore stock for all items
        for (const item of modReq.order.items) {
          await tx.menuItem.update({
            where: { id: item.menuItemId },
            data: { currentStock: { increment: item.quantity } },
          })
        }
        await tx.order.update({ where: { id: modReq.orderId }, data: { status: "CANCELLED" } })
      } else if (modReq.type === "REMOVE_ITEM") {
        const orderItem = modReq.order.items.find((i) => i.menuItemId === details.menuItemId)
        if (orderItem) {
          await tx.menuItem.update({
            where: { id: details.menuItemId },
            data: { currentStock: { increment: orderItem.quantity } },
          })
          await tx.orderItem.delete({ where: { id: orderItem.id } })
        }
      } else if (modReq.type === "EDIT_ITEM") {
        const orderItem = modReq.order.items.find((i) => i.menuItemId === details.menuItemId)
        if (orderItem) {
          const diff = orderItem.quantity - details.newQty
          if (diff > 0) {
            await tx.menuItem.update({
              where: { id: details.menuItemId },
              data: { currentStock: { increment: diff } },
            })
          } else if (diff < 0) {
            await tx.menuItem.update({
              where: { id: details.menuItemId },
              data: { currentStock: { increment: diff } }, // negative = decrement
            })
          }
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: { quantity: details.newQty },
          })
        }
      }

      // Update request status
      await tx.orderModificationRequest.update({
        where: { id: params.id },
        data: { status: "APPROVED", reviewedById, reviewedAt: new Date(), reviewNote: reviewNote || null },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: "Gagal menyetujui" }, { status: 500 })
  }
}
