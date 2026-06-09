import { NextResponse } from "next/server"

// Schema saat ini belum memiliki model OrderModificationRequest.
export async function PUT() {
  return NextResponse.json(
    { success: false, error: "Fitur persetujuan modifikasi belum tersedia" },
    { status: 501 }
  )
}
