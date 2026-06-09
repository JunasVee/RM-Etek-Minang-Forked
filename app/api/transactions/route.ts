export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date")
    const method = request.nextUrl.searchParams.get("method")
    const type = request.nextUrl.searchParams.get("type")

    const where: any = {}
    const orderWhere: any = {}

    if (dateParam) {
      const date = new Date(dateParam)
      const start = new Date(`${dateParam}T00:00:00+07:00`)
      const end   = new Date(`${dateParam}T23:59:59.999+07:00`)
      where.paidAt = { gte: start, lte: end }
    }

    if (method && method !== "all") {
      where.paymentMethod = method
    }

    if (type && type !== "all") {
      orderWhere.type = type
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        ...where,
        isVoid: false,
        order: Object.keys(orderWhere).length > 0 ? orderWhere : undefined,
      },
      include: {
        order: {
          include: {
            items: { include: { menuItem: true } },
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    })

    return NextResponse.json({ success: true, data: transactions })
  } catch (error) {
    console.error("❌ Gagal memuat transaksi:", error)  // ✅ Log error
    return NextResponse.json(
      { success: false, error: "Gagal memuat transaksi" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orderId, paymentMethod, cashReceived } = await request.json()

    if (!orderId || !paymentMethod) {
      return NextResponse.json(
        { success: false, error: "Data pembayaran tidak lengkap" },
        { status: 400 }
      )
    }

    // Fetch order with items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, transactions: true },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Pesanan tidak ditemukan" },
        { status: 404 }
      )
    }

    if (order.status === "PAID" || order.transactions.length > 0) {
      return NextResponse.json(
        { success: false, error: "Pesanan sudah dibayar" },
        { status: 400 }
      )
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Pesanan sudah dibatalkan" },
        { status: 400 }
      )
    }

    const totalAmount = order.items.reduce(
      (sum, item) => sum + item.priceAtOrder * item.quantity,
      0
    )

    // Validate cash payment
    if (paymentMethod === "CASH") {
      if (!cashReceived || cashReceived < totalAmount) {
        return NextResponse.json(
          { success: false, error: "Jumlah uang tidak mencukupi" },
          { status: 400 }
        )
      }
    }

    const changeAmount =
      paymentMethod === "CASH" ? (cashReceived || 0) - totalAmount : 0

    // Create transaction and update order in a transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // Re-check order status to handle concurrent access
      const freshOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      })

      if (freshOrder?.status !== "OPEN") {
        throw new Error("Pesanan sudah diproses oleh kasir lain")
      }

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: "PAID" },
      })

      // Create transaction record
      const newTransaction = await tx.transaction.create({
        data: {
          orderId,
          totalAmount,
          paymentMethod,
          cashReceived: paymentMethod === "CASH" ? cashReceived : null,
          changeAmount: paymentMethod === "CASH" ? changeAmount : null,
        },
        include: {
          order: {
            include: {
              items: { include: { menuItem: true } },
              createdBy: { select: { name: true } },
            },
          },
        },
      })

      return newTransaction
    })

    return NextResponse.json({ success: true, data: transaction }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses pembayaran" },
      { status: 500 }
    )
  }
}
