"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { formatRupiah, cn } from "@/lib/utils"
import { Check, X, Clock, CheckCircle, XCircle } from "lucide-react"
import { useSession } from "@/components/session-provider"
import { supabase } from "@/lib/supabase"

const TYPE_LABELS: Record<string, string> = {
  EDIT_ITEM: "Ubah Jumlah",
  REMOVE_ITEM: "Hapus Item",
  CANCEL_ORDER: "Batalkan Pesanan",
}
const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "Menunggu", color: "bg-yellow-500", icon: Clock },
  APPROVED: { label: "Disetujui", color: "bg-green-500", icon: CheckCircle },
  REJECTED: { label: "Ditolak", color: "bg-red-500", icon: XCircle },
}

export default function ApprovalsPage() {
  const session = useSession()
  const [requests, setRequests] = useState<any[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("PENDING")

  const [reviewReq, setReviewReq] = useState<any | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [processing, setProcessing] = useState(false)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/modification-requests?status=${filter}`)
    const data = await res.json()
    if (data.success) { setRequests(data.data); setPendingCount(data.pendingCount) }
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("mod-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "OrderModificationRequest" }, () => fetchRequests())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchRequests])

  const handleApprove = async () => {
    if (!reviewReq || !session) return
    setProcessing(true)
    const res = await fetch(`/api/modification-requests/${reviewReq.id}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewedById: session.userId, reviewNote }),
    })
    if ((await res.json()).success) { setReviewReq(null); setReviewNote(""); fetchRequests() }
    setProcessing(false)
  }

  const handleReject = async () => {
    if (!reviewReq || !session) return
    setProcessing(true)
    const res = await fetch(`/api/modification-requests/${reviewReq.id}/reject`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewedById: session.userId, reviewNote }),
    })
    if ((await res.json()).success) { setReviewReq(null); setReviewNote(""); fetchRequests() }
    setProcessing(false)
  }

  function parseDetails(req: any) {
    try {
      const d = JSON.parse(req.details)
      if (req.type === "CANCEL_ORDER") return "Batalkan seluruh pesanan"
      const item = req.order.items.find((i: any) => i.menuItemId === d.menuItemId)
      const name = item?.menuItem?.name || "Item"
      if (req.type === "REMOVE_ITEM") return `Hapus "${name}"`
      if (req.type === "EDIT_ITEM") return `"${name}": ${d.oldQty} → ${d.newQty} porsi`
      return "-"
    } catch { return "-" }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Persetujuan</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount > 0 ? `${pendingCount} permintaan menunggu persetujuan` : "Tidak ada permintaan tertunda"}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["PENDING", "APPROVED", "REJECTED", "all"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              filter === f ? "bg-amber-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}>
            {f === "PENDING" ? "Menunggu" : f === "APPROVED" ? "Disetujui" : f === "REJECTED" ? "Ditolak" : "Semua"}
            {f === "PENDING" && pendingCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pesanan</TableHead>
              <TableHead>Diminta Oleh</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead>Waktu</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : requests.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Tidak ada permintaan</TableCell></TableRow>
            ) : (
              requests.map((req) => {
                const st = STATUS_MAP[req.status]
                return (
                  <TableRow key={req.id} className={req.status === "PENDING" ? "bg-yellow-50" : ""}>
                    <TableCell className="font-mono font-medium text-sm">
                      {req.order.orderNumber}
                      {req.order.tableNumber && <span className="text-muted-foreground ml-1">M{req.order.tableNumber}</span>}
                    </TableCell>
                    <TableCell className="text-sm">{req.requestedBy.name}</TableCell>
                    <TableCell>
                      <Badge variant={req.type === "CANCEL_ORDER" ? "destructive" : "secondary"} className="text-xs">
                        {TYPE_LABELS[req.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{parseDetails(req)}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{req.reason}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(req.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("text-xs text-white", st.color)}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === "PENDING" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="text-green-600"
                            onClick={() => { setReviewReq({ ...req, action: "approve" }); setReviewNote("") }}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-red-500"
                            onClick={() => { setReviewReq({ ...req, action: "reject" }); setReviewNote("") }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        req.reviewedBy && <span className="text-xs text-muted-foreground">{req.reviewedBy.name}</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!reviewReq} onOpenChange={(v) => { if (!v) setReviewReq(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={reviewReq?.action === "approve" ? "text-green-700" : "text-red-600"}>
              {reviewReq?.action === "approve" ? "✅ Setujui Permintaan" : "❌ Tolak Permintaan"}
            </DialogTitle>
          </DialogHeader>
          {reviewReq && (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Pesanan</span><span className="font-mono font-bold">{reviewReq.order.orderNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Diminta oleh</span><span>{reviewReq.requestedBy.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tipe</span><Badge variant="secondary" className="text-xs">{TYPE_LABELS[reviewReq.type]}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Detail</span><span>{parseDetails(reviewReq)}</span></div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700 font-medium mb-1">Alasan Waiter:</p>
                <p className="text-sm">{reviewReq.reason}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Catatan (opsional)</label>
                <Input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Catatan untuk waiter..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewReq(null)}>Batal</Button>
            {reviewReq?.action === "approve" ? (
              <Button onClick={handleApprove} disabled={processing} className="bg-green-700 hover:bg-green-800">
                {processing ? "Memproses..." : "Setujui"}
              </Button>
            ) : (
              <Button onClick={handleReject} disabled={processing} className="bg-red-600 hover:bg-red-700">
                {processing ? "Memproses..." : "Tolak"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
