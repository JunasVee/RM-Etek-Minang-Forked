import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { splitGroup, splitLabel, totalAmount, paymentMethod, cashReceived } = await request.json()

    if (!splitGroup || !splitLabel || !totalAmount || !paymentMethod) {
      return NextResponse.json({ success: false, error: "Data tidak lengkap" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { transactions: true, items: true },
    })
    if (!order || (order.status !== "OPEN" && order.status !== "PARTIALLY_PAID")) {
      return NextResponse.json({ success: false, error: "Pesanan tidak aktif" }, { status: 400 })
    }

    // Check if this split label already paid
    const alreadyPaid = order.transactions.find((t) => t.splitGroup === splitGroup && t.splitLabel === splitLabel && !t.isVoid)
    if (alreadyPaid) {
      return NextResponse.json({ success: false, error: `${splitLabel} sudah membayar` }, { status: 400 })
    }

    const changeAmount = paymentMethod === "CASH" && cashReceived ? cashReceived - totalAmount : null

    const transaction = await prisma.transaction.create({
      data: {
        orderId: params.id,
        totalAmount,
        paymentMethod,
        cashReceived: paymentMethod === "CASH" ? cashReceived : null,
        changeAmount,
        splitGroup,
        splitLabel,
      },
    })

    // Check if all splits are now paid
    const allTx = await prisma.transaction.findMany({
      where: { orderId: params.id, splitGroup, isVoid: false },
    })
    const orderTotal = order.items.reduce((s, i) => s + i.priceAtOrder * i.quantity, 0)
    const paidTotal = allTx.reduce((s, t) => s + t.totalAmount, 0)

    if (paidTotal >= orderTotal) {
      await prisma.order.update({ where: { id: params.id }, data: { status: "PAID" } })
    } else {
      await prisma.order.update({ where: { id: params.id }, data: { status: "PARTIALLY_PAID" } })
    }

    return NextResponse.json({ success: true, data: { transaction, paidTotal, orderTotal, fullyPaid: paidTotal >= orderTotal } })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: "Gagal memproses pembayaran" }, { status: 500 })
  }
}

// GET split status
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true, transactions: { where: { isVoid: false } } },
    })
    if (!order) return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan" }, { status: 404 })

    const orderTotal = order.items.reduce((s, i) => s + i.priceAtOrder * i.quantity, 0)
    const paidTotal = order.transactions.reduce((s, t) => s + t.totalAmount, 0)

    return NextResponse.json({
      success: true,
      data: {
        orderTotal,
        paidTotal,
        remaining: orderTotal - paidTotal,
        fullyPaid: paidTotal >= orderTotal,
        payments: order.transactions.map((t) => ({
          id: t.id, label: t.splitLabel, amount: t.totalAmount,
          method: t.paymentMethod, paidAt: t.paidAt,
          splitGroup: t.splitGroup,
          cashReceived: t.cashReceived,
          changeAmount: t.changeAmount,
        })),
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 })
  }
}
