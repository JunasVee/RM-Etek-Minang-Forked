"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Lock } from "lucide-react"

type ModRequestDialogProps = {
  open: boolean
  onClose: () => void
  orderId: string
  orderNumber: string
  userId: string
  items: { menuItemId: string; name: string; quantity: number }[]
}

export default function ModRequestDialog({
  open, onClose, orderId, orderNumber, userId, items,
}: ModRequestDialogProps) {
  const [type, setType] = useState<string>("")
  const [selectedItem, setSelectedItem] = useState("")
  const [newQty, setNewQty] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const reset = () => {
    setType(""); setSelectedItem(""); setNewQty(""); setReason(""); setError(""); setSuccess(false)
  }

  const handleSubmit = async () => {
    if (!type) { setError("Pilih tipe perubahan"); return }
    if (type !== "CANCEL_ORDER" && !selectedItem) { setError("Pilih item"); return }
    if (reason.trim().length < 10) { setError("Alasan minimal 10 karakter"); return }

    const details: any = {}
    if (type === "REMOVE_ITEM") {
      details.menuItemId = selectedItem
      details.action = "remove"
    } else if (type === "EDIT_ITEM") {
      const nq = parseInt(newQty)
      if (!nq || nq < 1) { setError("Jumlah baru tidak valid"); return }
      const item = items.find((i) => i.menuItemId === selectedItem)
      details.menuItemId = selectedItem
      details.oldQty = item?.quantity || 0
      details.newQty = nq
    }

    setSubmitting(true); setError("")
    const res = await fetch(`/api/orders/${orderId}/modification-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedById: userId, type, details, reason: reason.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      setSuccess(true)
    } else {
      setError(data.error)
    }
    setSubmitting(false)
  }

  if (success) {
    return (
      <Dialog open={open} onOpenChange={() => { reset(); onClose() }}>
        <DialogContent className="sm:max-w-sm">
          <div className="text-center py-6">
            <div className="text-5xl mb-4">📩</div>
            <h2 className="text-lg font-bold mb-2">Permintaan Terkirim</h2>
            <p className="text-sm text-muted-foreground">
              Permintaan perubahan pesanan <span className="font-mono font-bold">{orderNumber}</span> telah
              dikirim ke Owner. Mohon tunggu persetujuan.
            </p>
            <Button onClick={() => { reset(); onClose() }} className="mt-4 bg-amber-800 hover:bg-amber-900">Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={() => { reset(); onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600" />
            Minta Persetujuan Owner
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Pesanan <span className="font-mono font-bold">{orderNumber}</span> — perubahan memerlukan persetujuan Owner.
          </p>

          {/* Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipe Perubahan</label>
            <Select value={type} onValueChange={(v) => { setType(v); setSelectedItem(""); setNewQty("") }}>
              <SelectTrigger><SelectValue placeholder="Pilih tipe..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EDIT_ITEM">Ubah Jumlah Item</SelectItem>
                <SelectItem value="REMOVE_ITEM">Hapus Item</SelectItem>
                <SelectItem value="CANCEL_ORDER">Batalkan Pesanan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Item selection */}
          {(type === "EDIT_ITEM" || type === "REMOVE_ITEM") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Pilih Item</label>
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger><SelectValue placeholder="Pilih item..." /></SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.menuItemId} value={item.menuItemId}>
                      {item.name} (×{item.quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* New qty */}
          {type === "EDIT_ITEM" && selectedItem && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Jumlah Baru</label>
              <Input type="number" min={1} value={newQty}
                onChange={(e) => setNewQty(e.target.value)} placeholder="Contoh: 1" />
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Alasan <span className="text-red-500">*</span></label>
            <textarea
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Pelanggan berubah pikiran, salah input menu..."
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-xs text-muted-foreground">{reason.trim().length}/10 karakter minimum</p>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 border border-red-200">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose() }}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-amber-800 hover:bg-amber-900">
            {submitting ? "Mengirim..." : "Kirim Permintaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
