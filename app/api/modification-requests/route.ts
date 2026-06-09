export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"

// Schema saat ini belum memiliki model OrderModificationRequest.
// Endpoint dinonaktifkan sampai schema diperbarui.
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Fitur permintaan modifikasi belum tersedia" },
    { status: 501 }
  )
}
