"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Printer, X } from "lucide-react"
import ReceiptTemplate, { type ReceiptData } from "@/components/receipt-template"
import { buildEscPosReceipt } from "@/lib/escpos"
import { printBytes } from "@/lib/printer"

type Props = { open: boolean; onClose: () => void; data: ReceiptData | null }
type PrintStatus = "idle" | "printing" | "done" | "error"

export default function ReceiptDialog({ open, onClose, data }: Props) {
  const [status, setStatus] = useState<PrintStatus>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const handlePrint = async () => {
    if (!data) return
    setStatus("printing")
    setErrorMsg("")
    try {
      await printBytes(buildEscPosReceipt(data))
      setStatus("done")
      setTimeout(() => { setStatus("idle"); onClose() }, 800)
    } catch (err: any) {
      setErrorMsg(err?.message || "Gagal mencetak")
      setStatus("error")
    }
  }

  if (!data) return null

  const isLoading = status === "printing"

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-lg">Preview Struk</h2>
        </div>

        {/* Preview */}
        <div className="flex justify-center p-4 bg-gray-100 max-h-[55vh] overflow-y-auto">
          <div className="bg-white shadow-lg rounded-sm">
            <ReceiptTemplate data={data} />
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isLoading}>
            <X className="h-4 w-4 mr-2" /> Tutup
          </Button>
          <Button onClick={handlePrint} disabled={isLoading} className="flex-1 bg-amber-800 hover:bg-amber-900">
            {isLoading
              ? <span className="animate-pulse">Mencetak...</span>
              : status === "done"
              ? <><Printer className="h-4 w-4 mr-2" /> Tercetak ✓</>
              : <><Printer className="h-4 w-4 mr-2" /> Cetak Struk</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
