export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== "OWNER") {
      return NextResponse.json(
        { success: false, error: "Hanya pemilik yang bisa membatalkan transaksi" },
        { status: 403 }
      )
    }

    const { reason } = await request.json()
    if (!reason?.trim()) {
      return NextResponse.json(
        { success: false, error: "Alasan pembatalan wajib diisi" },
        { status: 400 }
      )
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        order: { include: { items: true } },
      },
    })

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaksi tidak ditemukan" },
        { status: 404 }
      )
    }

    // Only allow voiding same-day transactions
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const paidDate = new Date(transaction.paidAt)
    paidDate.setHours(0, 0, 0, 0)
    if (paidDate.getTime() !== today.getTime()) {
      return NextResponse.json(
        { success: false, error: "Hanya bisa membatalkan transaksi hari ini" },
        { status: 400 }
      )
    }

    if (transaction.order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Transaksi sudah dibatalkan sebelumnya" },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      // Restore stock for each item
      for (const item of transaction.order.items) {
        await tx.menuItem.update({
          where: { id: item.menuItemId },
          data: { currentStock: { increment: item.quantity } },
        })

        await tx.stockLog.create({
          data: {
            menuItemId: item.menuItemId,
            changeType: "RESTOCK",
            quantity: item.quantity,
            note: `Void transaksi ${transaction.order.orderNumber}: ${reason}`,
          },
        })
      }

      // Update order status
      await tx.order.update({
        where: { id: transaction.orderId },
        data: { status: "CANCELLED" },
      })

      // Delete the transaction record
      await tx.transaction.delete({
        where: { id: params.id },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal membatalkan transaksi" },
      { status: 500 }
    )
  }
}
