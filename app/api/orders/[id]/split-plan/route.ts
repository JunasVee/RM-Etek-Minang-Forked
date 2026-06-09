export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"

// Schema saat ini belum memiliki kolom Order.splitPlan, jadi penyimpanan
// rencana bagi tagihan belum didukung.
export async function GET() {
  return NextResponse.json({ success: true, data: null })
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: "Fitur bagi tagihan belum tersedia" },
    { status: 501 }
  )
}
