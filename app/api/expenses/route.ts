export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date")
    const where: any = {}

    if (dateParam) {
      const date = new Date(dateParam)
      const start = new Date(date); start.setHours(0, 0, 0, 0)
      const end = new Date(date); end.setHours(23, 59, 59, 999)
      where.date = { gte: start, lte: end }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { recordedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: expenses })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat pengeluaran" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 })
    }

    const { date, description, amount } = await request.json()

    if (!description?.trim()) {
      return NextResponse.json({ success: false, error: "Deskripsi wajib diisi" }, { status: 400 })
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: "Jumlah harus lebih dari 0" }, { status: 400 })
    }

    const expense = await prisma.expense.create({
      data: {
        date: new Date(date || new Date()),
        description: description.trim(),
        amount: Math.round(amount),
        recordedById: session.userId,
      },
      include: { recordedBy: { select: { name: true } } },
    })

    return NextResponse.json({ success: true, data: expense }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal menyimpan pengeluaran" }, { status: 500 })
  }
}
