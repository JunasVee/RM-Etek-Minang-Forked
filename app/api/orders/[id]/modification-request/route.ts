import { NextResponse } from "next/server"

// Schema saat ini belum memiliki model OrderModificationRequest.
export async function POST() {
  return NextResponse.json(
    { success: false, error: "Fitur permintaan modifikasi belum tersedia" },
    { status: 501 }
  )
}
