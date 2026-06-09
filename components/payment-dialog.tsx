"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog"
import {
  Banknote, QrCode, CheckCircle2, ArrowLeft, ShoppingCart, Undo2, Trash, Printer,
} from "lucide-react"
import { formatRupiah, cn } from "@/lib/utils"
import ReceiptDialog from "@/components/receipt-dialog"
import type { ReceiptData } from "@/components/receipt-template"

type OrderItem = {
  menuItemId: string
  name: string
  price: number
  quantity: number
}

type PaymentDialogProps = {
  open: boolean
  onClose: () => void
  onComplete: () => void
  orderId: string
  orderNumber: string
  orderType: string
  tableNumber?: number | null
  items: OrderItem[]
}

type Step = "summary" | "cash" | "qris" | "success"

type TransactionResult = {
  id: string
  totalAmount: number
  paymentMethod: string
  cashReceived: number | null
  changeAmount: number | null
  paidAt: string
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]

export default function PaymentDialog({
  open, onClose, onComplete,
  orderId, orderNumber, orderType, tableNumber, items,
}: PaymentDialogProps) {
  const [step, setStep] = useState<Step>("summary")
  const [cashStack, setCashStack] = useState<number[]>([])
  const [manualInput, setManualInput] = useState("")
  const [useManual, setUseManual] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<TransactionResult | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const cashNum = useManual
    ? (parseInt(manualInput.replace(/\D/g, "")) || 0)
    : cashStack.reduce((s, v) => s + v, 0)
  const change = cashNum - total

  const reset = () => {
    setStep("summary")
    setCashStack([])
    setManualInput("")
    setUseManual(false)
    setError("")
    setResult(null)
    setShowReceipt(false)
    setProcessing(false)
  }

  const buildReceiptData = (): ReceiptData | null => {
    if (!result) return null
    const now = new Date(result.paidAt)
    return {
      orderNumber,
      date: now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }),
      time: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      type: orderType as "DINE_IN" | "TAKEAWAY",
      tableNumber,
      cashierName: result.order?.createdBy?.name || "Pelanggan",
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        subtotal: i.price * i.quantity,
      })),
      total: result.totalAmount,
      paymentMethod: result.paymentMethod as "CASH" | "QRIS",
      cashReceived: result.cashReceived,
      changeAmount: result.changeAmount,
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSuccess = () => {
    reset()
    onComplete()
  }

  const processPayment = async (method: "CASH" | "QRIS") => {
    setProcessing(true)
    setError("")

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentMethod: method,
          cashReceived: method === "CASH" ? cashNum : null,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setResult(data.data)
        setStep("success")
      } else {
        setError(data.error)
      }
    } catch {
      setError("Gagal menghubungi server")
    }
    setProcessing(false)
  }

  const addDenomination = (amount: number) => {
    setCashStack((prev) => [...prev, amount])
    setUseManual(false)
    setError("")
  }

  const undoLast = () => {
    setCashStack((prev) => prev.slice(0, -1))
    setError("")
  }

  const clearCash = () => {
    setCashStack([])
    setManualInput("")
    setUseManual(false)
    setError("")
  }

  const setExactAmount = () => {
    setCashStack([total])
    setUseManual(false)
    setError("")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* ===== STEP: Order Summary & Method Selection ===== */}
        {step === "summary" && (
          <div className="flex flex-col">
            <div className="p-5 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Pembayaran</h2>
                  <p className="text-sm text-muted-foreground font-mono">{orderNumber}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">
                    {orderType === "DINE_IN" ? "Dine-In" : "Takeaway"}
                  </Badge>
                  {tableNumber && <Badge variant="outline">Meja {tableNumber}</Badge>}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="p-5 max-h-60 overflow-auto space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground ml-2">×{item.quantity}</span>
                  </div>
                  <span className="font-mono shrink-0 ml-4">
                    {formatRupiah(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="px-5 py-4 border-t bg-amber-50">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-900">TOTAL</span>
                <span className="text-3xl font-bold text-amber-900">
                  {formatRupiah(total)}
                </span>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="p-5 border-t space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Pilih metode pembayaran:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setStep("cash"); setError("") }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all active:scale-[0.97]"
                >
                  <Banknote className="h-8 w-8 text-green-600" />
                  <span className="font-semibold">Tunai</span>
                </button>
                <button
                  onClick={() => { setStep("qris"); setError("") }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all active:scale-[0.97]"
                >
                  <QrCode className="h-8 w-8 text-blue-600" />
                  <span className="font-semibold">QRIS</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== STEP: Cash Payment ===== */}
        {step === "cash" && (
          <div className="flex flex-col max-h-[85vh]">
            <div className="p-5 border-b flex items-center gap-3 shrink-0">
              <button onClick={() => setStep("summary")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-lg font-bold">Pembayaran Tunai</h2>
                <p className="text-sm text-muted-foreground font-mono">{orderNumber}</p>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Total */}
              <div className="text-center py-3 bg-amber-50 rounded-xl">
                <p className="text-sm text-amber-700">Total Tagihan</p>
                <p className="text-3xl font-bold text-amber-900">{formatRupiah(total)}</p>
              </div>

              {/* Quick Denomination Buttons - Aggregate */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Ketuk pecahan uang:</p>
                  <div className="flex gap-1">
                    <button
                      onClick={undoLast}
                      disabled={cashStack.length === 0 || useManual}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Undo2 className="h-3 w-3" /> Undo
                    </button>
                    <button
                      onClick={clearCash}
                      disabled={cashStack.length === 0 || useManual}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash className="h-3 w-3" /> Reset
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => addDenomination(amt)}
                      className="py-2.5 rounded-lg text-sm font-semibold transition-all border bg-white text-gray-700 border-gray-200 hover:border-amber-400 hover:bg-amber-50 active:scale-95 active:bg-amber-100"
                    >
                      {amt >= 1000 ? `${amt / 1000}K` : amt}
                    </button>
                  ))}
                  <button
                    onClick={setExactAmount}
                    className="py-2.5 rounded-lg text-sm font-semibold transition-all border bg-white text-gray-700 border-gray-200 hover:border-amber-400 hover:bg-amber-50 active:scale-95"
                  >
                    Pas
                  </button>
                </div>

                {/* Stack breakdown */}
                <div className="flex flex-wrap gap-1.5 px-3 py-2 bg-gray-50 rounded-lg border min-h-[36px]">
                  {cashStack.length === 0 || useManual ? (
                    <span className="text-xs text-muted-foreground">Belum ada pecahan dipilih</span>
                  ) : (
                    cashStack.map((amt, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-semibold">
                        {formatRupiah(amt)}
                      </span>
                    ))
                  )}
                </div>

                {/* Total received display */}
                <div className="text-center py-2 bg-white rounded-xl border-2 border-amber-200">
                  <p className="text-xs text-muted-foreground">Uang Diterima</p>
                  <p className="text-2xl font-bold text-amber-900">{formatRupiah(cashNum)}</p>
                </div>

                {/* Manual override input */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">Manual: Rp</span>
                  <Input
                    value={useManual ? (parseInt(manualInput) > 0 ? parseInt(manualInput).toLocaleString("id-ID") : "") : ""}
                    onFocus={() => setUseManual(true)}
                    onChange={(e) => {
                      setManualInput(e.target.value.replace(/\D/g, ""))
                      setUseManual(true)
                      setError("")
                    }}
                    className="pl-24 h-10 text-base font-bold text-center"
                    placeholder="Ketik manual..."
                    inputMode="numeric"
                  />
                </div>
              </div>

              {/* Change Display */}
              <div className={cn(
                "text-center py-4 rounded-xl border-2",
                cashNum === 0
                  ? "bg-gray-50 border-gray-200"
                  : change >= 0
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              )}>
                <p className={cn(
                  "text-sm font-medium",
                  cashNum === 0
                    ? "text-muted-foreground"
                    : change >= 0 ? "text-green-700" : "text-red-600"
                )}>
                  {cashNum === 0 ? "Kembalian" : change >= 0 ? "Kembalian" : "Kurang"}
                </p>
                <p className={cn(
                  "text-4xl font-bold mt-1",
                  cashNum === 0
                    ? "text-muted-foreground"
                    : change >= 0 ? "text-green-800" : "text-red-700"
                )}>
                  {cashNum === 0 ? "Rp 0" : formatRupiah(Math.abs(change))}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 border border-red-200">
                  {error}
                </div>
              )}
            </div>

            <div className="p-5 border-t shrink-0">
              <Button
                onClick={() => processPayment("CASH")}
                disabled={processing || cashNum < total}
                className="w-full h-14 text-lg font-bold bg-green-700 hover:bg-green-800"
              >
                {processing ? "Memproses..." : "Konfirmasi Pembayaran"}
              </Button>
            </div>
          </div>
        )}

        {/* ===== STEP: QRIS Payment ===== */}
        {step === "qris" && (
          <div className="flex flex-col">
            <div className="p-5 border-b flex items-center gap-3">
              <button onClick={() => setStep("summary")} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-lg font-bold">Pembayaran QRIS</h2>
                <p className="text-sm text-muted-foreground font-mono">{orderNumber}</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Total */}
              <div className="text-center py-3 bg-blue-50 rounded-xl">
                <p className="text-sm text-blue-700">Total Tagihan</p>
                <p className="text-3xl font-bold text-blue-900">{formatRupiah(total)}</p>
              </div>

              {/* QR Placeholder */}
              <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <QrCode className="h-24 w-24 text-gray-300 mb-3" />
                <p className="text-sm text-muted-foreground">QR Code akan tampil di sini</p>
                <p className="text-xs text-muted-foreground mt-1">(Integrasi QRIS di tahap berikutnya)</p>
              </div>

              <p className="text-sm text-center text-muted-foreground">
                Setelah pelanggan membayar via QRIS, klik tombol di bawah untuk mengkonfirmasi.
              </p>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 border border-red-200">
                  {error}
                </div>
              )}
            </div>

            <div className="p-5 border-t space-y-2">
              <Button
                onClick={() => processPayment("QRIS")}
                disabled={processing}
                className="w-full h-14 text-lg font-bold bg-blue-700 hover:bg-blue-800"
              >
                {processing ? "Memproses..." : "Pembayaran Diterima"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("summary")}
                className="w-full"
              >
                Ganti Metode
              </Button>
            </div>
          </div>
        )}

        {/* ===== STEP: Success ===== */}
        {step === "success" && result && (
          <div className="flex flex-col items-center py-8 px-5">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>

            <h2 className="text-xl font-bold text-green-800">Pembayaran Berhasil!</h2>
            <p className="text-sm text-muted-foreground mt-1 font-mono">{orderNumber}</p>

            <div className="w-full mt-6 space-y-3 bg-gray-50 rounded-xl p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">{formatRupiah(result.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Metode</span>
                <Badge variant="outline">
                  {result.paymentMethod === "CASH" ? "Tunai" : "QRIS"}
                </Badge>
              </div>
              {result.paymentMethod === "CASH" && result.cashReceived && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Diterima</span>
                    <span className="font-mono">{formatRupiah(result.cashReceived)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-3">
                    <span className="font-semibold">Kembalian</span>
                    <span className="text-2xl font-bold text-green-700">
                      {formatRupiah(result.changeAmount || 0)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm border-t pt-3">
                <span className="text-muted-foreground">Waktu</span>
                <span className="text-sm">
                  {new Date(result.paidAt).toLocaleTimeString("id-ID", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            <div className="w-full mt-6 space-y-2">
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => setShowReceipt(true)}
              >
                <Printer className="h-4 w-4 mr-2" /> Cetak Struk
              </Button>
              <Button
                onClick={handleSuccess}
                className="w-full h-12 font-semibold bg-amber-800 hover:bg-amber-900"
              >
                <ShoppingCart className="h-4 w-4 mr-2" /> Pesanan Baru
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Receipt Dialog */}
      <ReceiptDialog
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
        data={buildReceiptData()}
      />
    </Dialog>
  )
}
