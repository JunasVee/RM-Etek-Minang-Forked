import { NextResponse } from "next/server"

// Schema saat ini memiliki relasi Order.transaction (one-to-one) tanpa kolom
// splitGroup/splitLabel/isVoid, jadi split bill belum dapat didukung.
export async function POST() {
  return NextResponse.json(
    { success: false, error: "Fitur bagi tagihan belum tersedia" },
    { status: 501 }
  )
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Fitur bagi tagihan belum tersedia" },
    { status: 501 }
  )
}
