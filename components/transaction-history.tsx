"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Eye, Printer, Ban, Receipt, Users } from "lucide-react"
import { formatRupiah } from "@/lib/utils"
import ReceiptDialog from "@/components/receipt-dialog"
import type { ReceiptData } from "@/components/receipt-template"

type TransactionItem = {
  id: string
  orderId: string
  totalAmount: number
  paymentMethod: string
  cashReceived: number | null
  changeAmount: number | null
  splitGroup: string | null
  splitLabel: string | null
  paidAt: string
  order: {
    orderNumber: string
    type: string
    tableNumber: number | null
    status: string
    items: {
      quantity: number
      priceAtOrder: number
      menuItem: { name: string }
    }[]
    createdBy: { name: string }
  }
}

// Consolidated row: either a single tx or a group of split txs
type DisplayRow = {
  key: string
  orderNumber: string
  paidAt: string
  type: string
  tableNumber: number | null
  total: number
  cashier: string
  isSplit: boolean
  // Single tx fields
  tx?: TransactionItem
  paymentMethod?: string
  // Split group fields
  splitMembers?: {
    label: string
    amount: number
    method: string
    cashReceived: number | null
    changeAmount: number | null
  }[]
  groupSize?: number
  order?: TransactionItem["order"]
}

type Summary = {
  totalCount: number; totalRevenue: number
  cashCount: number; cashRevenue: number
  qrisCount: number; qrisRevenue: number
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function TransactionHistory({ canVoid = false }: { canVoid?: boolean }) {
  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [displayRows, setDisplayRows] = useState<DisplayRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayStr())
  const [method, setMethod] = useState("all")
  const [type, setType] = useState("all")
  const [detailRow, setDetailRow] = useState<DisplayRow | null>(null)
  const [voidItem, setVoidItem] = useState<TransactionItem | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [voiding, setVoiding] = useState(false)
  const [voidError, setVoidError] = useState("")
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  // Consolidate split transactions into display rows
  const consolidate = (txs: TransactionItem[]): DisplayRow[] => {
    const rows: DisplayRow[] = []
    const splitGroups = new Map<string, TransactionItem[]>()
    const standalone: TransactionItem[] = []

    for (const tx of txs) {
      if (tx.splitGroup) {
        const group = splitGroups.get(tx.splitGroup) || []
        group.push(tx)
        splitGroups.set(tx.splitGroup, group)
      } else {
        standalone.push(tx)
      }
    }

    // Add standalone transactions
    for (const tx of standalone) {
      rows.push({
        key: tx.id,
        orderNumber: tx.order.orderNumber,
        paidAt: tx.paidAt,
        type: tx.order.type,
        tableNumber: tx.order.tableNumber,
        total: tx.totalAmount,
        cashier: tx.order.createdBy?.name || "Pelanggan",
        isSplit: false,
        tx,
        paymentMethod: tx.paymentMethod,
      })
    }

    // Add consolidated split groups (only if ALL members paid = order PAID)
    splitGroups.forEach((members, groupKey) => {
      const first = members[0]
      // Only show if order is fully paid
      if (first.order.status !== "PAID") return

      const groupTotal = members.reduce((s, m) => s + m.totalAmount, 0)
      rows.push({
        key: `split_${groupKey}`,
        orderNumber: first.order.orderNumber,
        paidAt: members[members.length - 1].paidAt, // Last payment time
        type: first.order.type,
        tableNumber: first.order.tableNumber,
        total: groupTotal,
        cashier: first.order.createdBy?.name || "Pelanggan",
        isSplit: true,
        groupSize: members.length,
        splitMembers: members.map((m) => ({
          label: m.splitLabel || "Orang",
          amount: m.totalAmount,
          method: m.paymentMethod,
          cashReceived: m.cashReceived,
          changeAmount: m.changeAmount,
        })),
        order: first.order,
      })
    })

    // Sort by paidAt descending
    rows.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    return rows
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ date })
    if (method !== "all") params.set("method", method)
    if (type !== "all") params.set("type", type)

    const [txRes, sumRes] = await Promise.all([
      fetch(`/api/transactions?${params}`),
      fetch(`/api/transactions/summary?date=${date}`),
    ])
    const [txData, sumData] = await Promise.all([txRes.json(), sumRes.json()])
    if (txData.success) {
      setTransactions(txData.data)
      setDisplayRows(consolidate(txData.data))
    }
    if (sumData.success) setSummary(sumData.data)
    setLoading(false)
  }, [date, method, type])

  useEffect(() => { fetchData() }, [fetchData])

  const buildReceipt = (tx: TransactionItem): ReceiptData => {
    const paid = new Date(tx.paidAt)
    return {
      orderNumber: tx.order.orderNumber,
      date: paid.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }),
      time: paid.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      type: tx.order.type as "DINE_IN" | "TAKEAWAY",
      tableNumber: tx.order.tableNumber,
      cashierName: tx.order.createdBy?.name || "Pelanggan",
      items: tx.order.items.map((i) => ({
        name: i.menuItem.name, quantity: i.quantity, price: i.priceAtOrder, subtotal: i.priceAtOrder * i.quantity,
      })),
      total: tx.totalAmount,
      paymentMethod: tx.paymentMethod as "CASH" | "QRIS",
      cashReceived: tx.cashReceived,
      changeAmount: tx.changeAmount,
    }
  }

  const openReceipt = (tx: TransactionItem) => { setReceiptData(buildReceipt(tx)); setReceiptOpen(true) }

  const handleVoid = async () => {
    if (!voidItem || !voidReason.trim()) { setVoidError("Alasan pembatalan wajib diisi"); return }
    setVoiding(true); setVoidError("")
    const res = await fetch(`/api/transactions/${voidItem.id}/void`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: voidReason }),
    })
    const data = await res.json()
    if (data.success) { setVoidItem(null); setVoidReason(""); fetchData() }
    else { setVoidError(data.error) }
    setVoiding(false)
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-muted-foreground">Total Transaksi</p>
            <p className="text-2xl font-bold mt-1">{displayRows.length}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-muted-foreground">Total Pendapatan</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{formatRupiah(summary.totalRevenue)}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-muted-foreground">Tunai</p>
            <p className="text-lg font-bold mt-1">{formatRupiah(summary.cashRevenue)}</p>
            <p className="text-xs text-muted-foreground">{summary.cashCount} transaksi</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-muted-foreground">QRIS</p>
            <p className="text-lg font-bold mt-1">{formatRupiah(summary.qrisRevenue)}</p>
            <p className="text-xs text-muted-foreground">{summary.qrisCount} transaksi</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Metode</SelectItem>
            <SelectItem value="CASH">Tunai</SelectItem>
            <SelectItem value="QRIS">QRIS</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            <SelectItem value="DINE_IN">Dine-In</SelectItem>
            <SelectItem value="TAKEAWAY">Takeaway</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-2">{displayRows.length} transaksi</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Pesanan</TableHead>
              <TableHead>Waktu</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Metode</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Kasir</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Memuat...</TableCell></TableRow>
            ) : displayRows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Tidak ada transaksi</TableCell></TableRow>
            ) : (
              displayRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-mono font-medium text-sm">
                    {row.orderNumber}
                    {row.isSplit && (
                      <Badge className="ml-2 text-[10px] bg-amber-100 text-amber-800 border-amber-300" variant="outline">
                        <Users className="h-3 w-3 mr-0.5" />{row.groupSize}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(row.paidAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{row.type === "DINE_IN" ? "Dine-In" : "Takeaway"}</Badge>
                  </TableCell>
                  <TableCell>
                    {row.isSplit ? (
                      <Badge variant="outline" className="text-xs">Campuran</Badge>
                    ) : (
                      <Badge variant={row.paymentMethod === "CASH" ? "secondary" : "default"} className="text-xs">
                        {row.paymentMethod === "CASH" ? "Tunai" : "QRIS"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatRupiah(row.total)}</TableCell>
                  <TableCell className="text-sm">{row.cashier}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetailRow(row)} title="Detail">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!row.isSplit && row.tx && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openReceipt(row.tx!)} title="Cetak Struk">
                            <Printer className="h-4 w-4" />
                          </Button>
                          {canVoid && (
                            <Button variant="ghost" size="icon" onClick={() => { setVoidItem(row.tx!); setVoidReason(""); setVoidError("") }}
                              className="text-red-500 hover:text-red-700" title="Void">
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ===== Detail Dialog ===== */}
      <Dialog open={!!detailRow} onOpenChange={(v) => { if (!v) setDetailRow(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          {detailRow && (
            <>
              <DialogHeader className="p-5 pb-3 shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Detail Transaksi
                  {detailRow.isSplit && <Badge className="bg-amber-100 text-amber-800 border-amber-300" variant="outline"><Users className="h-3 w-3 mr-1" />Split Bill</Badge>}
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
                {/* Order Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">No. Pesanan</span><span className="font-mono font-bold">{detailRow.orderNumber}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Waktu</span>
                    <span>{new Date(detailRow.paidAt).toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tipe</span><Badge variant="outline">{detailRow.type === "DINE_IN" ? "Dine-In" : "Takeaway"}</Badge></div>
                  {detailRow.tableNumber && <div className="flex justify-between"><span className="text-muted-foreground">Meja</span><span>{detailRow.tableNumber}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Kasir</span><span>{detailRow.cashier}</span></div>
                </div>

                {/* Items */}
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Item Pesanan</p>
                  {(detailRow.isSplit ? detailRow.order! : detailRow.tx!.order).items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <div><span className="font-medium">{item.menuItem.name}</span><span className="text-muted-foreground ml-2">×{item.quantity}</span></div>
                      <span className="font-mono">{formatRupiah(item.priceAtOrder * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                {/* Payment — different for split vs normal */}
                {detailRow.isSplit ? (
                  <>
                    {/* Split Bill Summary */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-bold text-amber-800 flex items-center gap-1"><Users className="h-3 w-3" /> Pembagian Tagihan ({detailRow.groupSize} orang)</p>
                      {detailRow.splitMembers!.map((m, i) => (
                        <div key={i} className="flex justify-between text-sm border-b border-amber-100 last:border-0 pb-1 last:pb-0">
                          <div>
                            <span className="font-medium">{m.label}</span>
                            <Badge variant="outline" className="ml-1.5 text-[10px]">{m.method === "CASH" ? "Tunai" : "QRIS"}</Badge>
                          </div>
                          <span className="font-mono font-bold">{formatRupiah(m.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-green-700">{formatRupiah(detailRow.total)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm font-bold text-lg">
                      <span>Total</span>
                      <span className="text-green-700">{formatRupiah(detailRow.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Metode</span>
                      <Badge variant={detailRow.paymentMethod === "CASH" ? "secondary" : "default"}>
                        {detailRow.paymentMethod === "CASH" ? "Tunai" : "QRIS"}
                      </Badge>
                    </div>
                    {detailRow.paymentMethod === "CASH" && detailRow.tx && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Diterima</span>
                          <span className="font-mono">{formatRupiah(detailRow.tx.cashReceived || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Kembalian</span>
                          <span className="font-mono font-bold">{formatRupiah(detailRow.tx.changeAmount || 0)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="p-5 pt-3 border-t flex gap-2 shrink-0">
                <Button variant="outline" onClick={() => setDetailRow(null)} className="flex-1">Tutup</Button>
                {!detailRow.isSplit && detailRow.tx && (
                  <Button onClick={() => { openReceipt(detailRow.tx!); setDetailRow(null) }} className="flex-1 bg-amber-800 hover:bg-amber-900">
                    <Printer className="h-4 w-4 mr-2" /> Cetak Struk
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Void Dialog ===== */}
      {canVoid && (
        <Dialog open={!!voidItem} onOpenChange={(v) => { if (!v) setVoidItem(null) }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle className="text-red-600">Void Transaksi</DialogTitle></DialogHeader>
            {voidItem && (
              <div className="space-y-4 py-2">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Pesanan:</span> <span className="font-mono font-bold">{voidItem.order.orderNumber}</span></p>
                  <p><span className="text-muted-foreground">Total:</span> <span className="font-bold">{formatRupiah(voidItem.totalAmount)}</span></p>
                  <p><span className="text-muted-foreground">Metode:</span> {voidItem.paymentMethod === "CASH" ? "Tunai" : "QRIS"}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  Void akan mengembalikan stok menu dan menghapus transaksi dari pendapatan.
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Alasan pembatalan <span className="text-red-500">*</span></label>
                  <Input value={voidReason} onChange={(e) => { setVoidReason(e.target.value); setVoidError("") }} placeholder="Contoh: Pelanggan batal, salah input, dll." />
                </div>
                {voidError && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 border border-red-200">{voidError}</div>}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setVoidItem(null)}>Batal</Button>
              <Button onClick={handleVoid} disabled={voiding} className="bg-red-600 hover:bg-red-700">{voiding ? "Memproses..." : "Konfirmasi Void"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Receipt Dialog */}
      <ReceiptDialog open={receiptOpen} onClose={() => setReceiptOpen(false)} data={receiptData} />
    </div>
  )
}
