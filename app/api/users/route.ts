export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const all = request.nextUrl.searchParams.get("all") === "true"
    const users = await prisma.user.findMany({
      where: all ? {} : { isActive: true },
      select: { id: true, name: true, username: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: "asc" },
    })
    return NextResponse.json({ success: true, data: users })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal memuat pengguna" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, username, pin, role } = await request.json()
    if (!name?.trim()) return NextResponse.json({ success: false, error: "Nama wajib diisi" }, { status: 400 })
    if (!username?.trim()) return NextResponse.json({ success: false, error: "Username wajib diisi" }, { status: 400 })
    if (!/^\d{4}$/.test(pin)) return NextResponse.json({ success: false, error: "PIN harus 4 digit angka" }, { status: 400 })
    if (!role) return NextResponse.json({ success: false, error: "Role wajib dipilih" }, { status: 400 })

    const existing = await prisma.user.findUnique({ where: { username: username.trim() } })
    if (existing) return NextResponse.json({ success: false, error: "Username sudah digunakan" }, { status: 400 })

    const user = await prisma.user.create({
      data: { name: name.trim(), username: username.trim(), pin, role },
      select: { id: true, name: true, username: true, role: true, isActive: true, createdAt: true },
    })
    return NextResponse.json({ success: true, data: user }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: "Gagal menambah pengguna" }, { status: 500 })
  }
}
