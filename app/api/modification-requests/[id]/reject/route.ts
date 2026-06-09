import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { reviewedById, reviewNote } = await request.json()

    const modReq = await prisma.orderModificationRequest.findUnique({ where: { id: params.id } })
    if (!modReq || modReq.status !== "PENDING") {
      return NextResponse.json({ success: false, error: "Permintaan tidak ditemukan" }, { status: 404 })
    }

    await prisma.orderModificationRequest.update({
      where: { id: params.id },
      data: { status: "REJECTED", reviewedById, reviewedAt: new Date(), reviewNote: reviewNote || null },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal menolak" }, { status: 500 })
  }
}
