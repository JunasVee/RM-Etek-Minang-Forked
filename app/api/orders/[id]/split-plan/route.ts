export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET - load split plan
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: { splitPlan: true },
    })
    if (!order) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })

    const plan = order.splitPlan ? JSON.parse(order.splitPlan) : null
    return NextResponse.json({ success: true, data: plan })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat data" }, { status: 500 })
  }
}

// PUT - save split plan
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    await prisma.order.update({
      where: { id: params.id },
      data: { splitPlan: JSON.stringify(body) },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal menyimpan" }, { status: 500 })
  }
}
