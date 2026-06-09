import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { requestedById, type, details, reason } = await request.json()

    if (!requestedById || !type || !details || !reason) {
      return NextResponse.json({ success: false, error: "Data tidak lengkap" }, { status: 400 })
    }
    if (reason.trim().length < 10) {
      return NextResponse.json({ success: false, error: "Alasan minimal 10 karakter" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({ where: { id: params.id } })
    if (!order || order.status !== "OPEN") {
      return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan atau tidak aktif" }, { status: 400 })
    }

    // Check no existing pending request for same order
    const existing = await prisma.orderModificationRequest.findFirst({
      where: { orderId: params.id, status: "PENDING" },
    })
    if (existing) {
      return NextResponse.json({ success: false, error: "Sudah ada permintaan yang menunggu persetujuan" }, { status: 400 })
    }

    const modRequest = await prisma.orderModificationRequest.create({
      data: {
        orderId: params.id,
        requestedById,
        type,
        details: JSON.stringify(details),
        reason: reason.trim(),
      },
      include: {
        order: { select: { orderNumber: true } },
        requestedBy: { select: { name: true } },
      },
    })

    return NextResponse.json({ success: true, data: modRequest }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, error: "Gagal mengirim permintaan" }, { status: 500 })
  }
}
