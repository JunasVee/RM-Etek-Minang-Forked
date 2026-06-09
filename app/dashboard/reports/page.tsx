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
import { formatRupiah, cn } from "@/lib/utils"
import { Download, FileSpreadsheet, TrendingUp, TrendingDown, Calendar } from "lucide-react"
import dynamic from "next/dynamic"

const RevenueLine = dynamic(() => import("@/components/analytics-charts").then((m) => m.RevenueTrend), { ssr: false, loading: () => <div className="h-[250px] bg-gray-50 rounded-lg animate-pulse" /> })
const TopItemsBar = dynamic(() => import("@/components/analytics-charts").then((m) => m.TopItemsBar), { ssr: false, loading: () => <div className="h-[250px] bg-gray-50 rounded-lg animate-pulse" /> })
const MethodPie = dynamic(() => import("@/components/analytics-charts").then((m) => m.MethodPie), { ssr: false, loading: () => <div className="h-[250px] bg-gray-50 rounded-lg animate-pulse" /> })

// Date helpers
// ✅ Pakai local date methods (mengikuti timezone browser = WIB)
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)
}

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function getWeekRange(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const mondayOff = day === 0 ? -6 : 1 - day
  const mon = new Date(d); mon.setDate(d.getDate() + mondayOff)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { start: localDateStr(mon), end: localDateStr(sun) }  // ✅
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return { start: localDateStr(start), end: localDateStr(end) }  // ✅
}

function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((cur - prev) / prev) * 100)
}

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

type PeriodType = "daily" | "weekly" | "monthly" | "custom"

export default function ReportsPage() {
  const [period, setPeriod] = useState<PeriodType>("daily")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  // Daily
  const [dailyDate, setDailyDate] = useState(todayStr())
  // Weekly
  const [weekDate, setWeekDate] = useState(todayStr())
  // Monthly
  const [monthYear, setMonthYear] = useState(new Date().getFullYear())
  const [monthMonth, setMonthMonth] = useState(new Date().getMonth())
  // Custom
  // ✅ customStart pakai local date
  const [customStart, setCustomStart] = useState(() => {
  const d = new Date(); d.setDate(d.getDate() - 6); return localDateStr(d)
  })
  const [customEnd, setCustomEnd] = useState(todayStr())

  const getRange = useCallback(() => {
    if (period === "daily") return { start: dailyDate, end: dailyDate }
    if (period === "weekly") return getWeekRange(new Date(weekDate))
    if (period === "monthly") return getMonthRange(monthYear, monthMonth)
    return { start: customStart, end: customEnd }
  }, [period, dailyDate, weekDate, monthYear, monthMonth, customStart, customEnd])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    const { start, end } = getRange()
    const res = await fetch(`/api/reports/range?startDate=${start}&endDate=${end}`)
    const d = await res.json()
    if (d.success) setData(d.data)
    setLoading(false)
  }, [getRange])

  useEffect(() => { fetchReport() }, [fetchReport])

  const getPeriodLabel = () => {
    if (period === "daily") return new Date(dailyDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    if (period === "weekly") {
      const { start, end } = getWeekRange(new Date(weekDate))
      const s = new Date(start), e = new Date(end)
      return `${s.getDate()}-${e.getDate()} ${s.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`
    }
    if (period === "monthly") return `${MONTHS[monthMonth]} ${monthYear}`
    return `${new Date(customStart).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${new Date(customEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
  }

  const getFilename = () => {
    if (period === "daily") return `Laporan_Harian_${dailyDate.replace(/-/g, "")}`
    if (period === "weekly") { const { start } = getWeekRange(new Date(weekDate)); return `Laporan_Mingguan_${start.replace(/-/g, "")}` }
    if (period === "monthly") return `Laporan_Bulanan_${monthYear}_${(monthMonth + 1).toString().padStart(2, "0")}`
    return `Laporan_${customStart.replace(/-/g, "")}_to_${customEnd.replace(/-/g, "")}`
  }

  const handleExportPDF = () => {
    if (!data) return
    const s = data.summary
    const filename = getFilename()
    const periodLabel = getPeriodLabel()
    const periodTitle = period === "daily" ? "HARIAN" : period === "weekly" ? "MINGGUAN" : period === "monthly" ? "BULANAN" : "CUSTOM"

    const html = `<!DOCTYPE html>
<html><head><title>${filename}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; padding: 15mm; color: #333; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 2px; }
  h2 { font-size: 13px; text-align: center; margin-bottom: 4px; color: #666; }
  .date { text-align: center; margin-bottom: 15px; color: #888; }
  .section { margin-top: 18px; margin-bottom: 8px; font-size: 13px; font-weight: bold; border-bottom: 2px solid #b45309; padding-bottom: 3px; color: #92400e; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th { background: #92400e; color: white; padding: 5px 6px; text-align: left; font-size: 9px; }
  td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 9px; }
  tr:nth-child(even) { background: #fef9ee; }
  .right { text-align: right; } .center { text-align: center; } .bold { font-weight: bold; }
  .total-row { background: #f5f5f5 !important; font-weight: bold; }
  .best { background: #dcfce7 !important; } .worst { background: #fee2e2 !important; }
  .footer { margin-top: 20px; text-align: center; font-size: 8px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print { body { padding: 10mm; } @page { size: A4; margin: 10mm; } }
</style>
</head><body>
<h1>LAPORAN ${periodTitle}</h1>
<h2>RM. ETEK MINANG</h2>
<div class="date">${periodLabel}</div>

<div class="section">RINGKASAN</div>
<table>
  <tr><td>Total Pendapatan</td><td class="right bold">${fmtRp(s.totalRevenue)}</td></tr>
  <tr><td>Total Pengeluaran</td><td class="right bold">${s.hasExpenses ? fmtRp(s.totalExpenses) : fmtRp(0) + ' (belum dicatat)'}</td></tr>
  <tr><td>Profit</td><td class="right bold">${fmtRp(s.profit)}</td></tr>
  <tr><td>Jumlah Transaksi</td><td class="right bold">${s.totalCount}</td></tr>
  <tr><td>Rata-rata / Hari</td><td class="right">${fmtRp(s.avgDailyRevenue)}</td></tr>
  ${s.bestDay ? `<tr><td>Hari Terbaik</td><td class="right">${s.bestDay.dateFormatted} — ${fmtRp(s.bestDay.revenue)}</td></tr>` : ""}
  ${s.worstDay ? `<tr><td>Hari Terburuk</td><td class="right">${s.worstDay.dateFormatted} — ${fmtRp(s.worstDay.revenue)}</td></tr>` : ""}
  <tr><td>Tunai</td><td class="right">${s.cash.count} trx — ${fmtRp(s.cash.revenue)}</td></tr>
  <tr><td>QRIS</td><td class="right">${s.qris.count} trx — ${fmtRp(s.qris.revenue)}</td></tr>
</table>

${data.daily.length > 1 ? `
<div class="section">BREAKDOWN HARIAN</div>
<table>
  <tr><th>Tanggal</th><th class="right">Pendapatan</th><th class="right">Pengeluaran</th><th class="right">Profit</th><th class="center">Trx</th></tr>
  ${data.daily.map((d: any) => `<tr class="${s.bestDay && d.date === s.bestDay.date ? 'best' : s.worstDay && d.date === s.worstDay.date ? 'worst' : ''}"><td>${d.date}</td><td class="right">${fmtRp(d.revenue)}</td><td class="right">${fmtRp(d.expenses)}</td><td class="right">${fmtRp(d.profit)}</td><td class="center">${d.count}</td></tr>`).join("")}
  <tr class="total-row"><td>TOTAL</td><td class="right">${fmtRp(s.totalRevenue)}</td><td class="right">${fmtRp(s.totalExpenses)}</td><td class="right">${fmtRp(s.profit)}</td><td class="center">${s.totalCount}</td></tr>
</table>` : ""}

${data.menuSales.length > 0 ? `
<div class="section">PENJUALAN MENU</div>
<table>
  <tr><th class="center">No</th><th>Menu</th><th>Kategori</th><th class="center">Porsi</th><th class="right">Pendapatan</th></tr>
  ${data.menuSales.map((m: any, i: number) => `<tr><td class="center">${i + 1}</td><td>${m.name}</td><td>${m.category}</td><td class="center">${m.qty}</td><td class="right">${fmtRp(m.revenue)}</td></tr>`).join("")}
</table>` : ""}

${data.expenseList.length > 0 ? `
<div class="section">PENGELUARAN</div>
<table>
  <tr><th>Tanggal</th><th>Deskripsi</th><th class="right">Jumlah</th><th>Dicatat</th></tr>
  ${data.expenseList.map((e: any) => `<tr><td>${e.date}</td><td>${e.description}</td><td class="right">${fmtRp(e.amount)}</td><td>${e.recordedBy}</td></tr>`).join("")}
  <tr class="total-row"><td>TOTAL</td><td></td><td class="right">${fmtRp(s.totalExpenses)}</td><td></td></tr>
</table>` : ""}

<div class="footer">Generated by POS System RM. Etek Minang — ${new Date().toLocaleString("id-ID")}</div>
</body></html>`

    const win = window.open("", "_blank", "width=800,height=600")
    if (!win) { alert("Pop-up diblokir browser."); return }
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.print() }
  }

  const handleExportExcel = async () => {
    if (!data) return
    const XLSX = await import("xlsx")
    const wb = XLSX.utils.book_new()
    const s = data.summary
    const fn = getFilename()

    // Sheet 1: Summary
    const sum = [
      [`LAPORAN - RM. ETEK MINANG`], [getPeriodLabel()], [],
      ["Keterangan", "Nilai"],
      ["Total Pendapatan", s.totalRevenue], ["Total Pengeluaran", s.totalExpenses],
      ["Profit", s.profit], ["Jumlah Transaksi", s.totalCount],
      ["Rata-rata / Hari", s.avgDailyRevenue],
      ...(s.bestDay ? [["Hari Terbaik", `${s.bestDay.date} (${s.bestDay.revenue})`]] : []),
      ...(s.worstDay ? [["Hari Terburuk", `${s.worstDay.date} (${s.worstDay.revenue})`]] : []),
      [], ["Metode", "Transaksi", "Pendapatan"],
      ["Tunai", s.cash.count, s.cash.revenue], ["QRIS", s.qris.count, s.qris.revenue],
      [], ["Tipe", "Transaksi", "Pendapatan"],
      ["Dine-In", s.dineIn.count, s.dineIn.revenue], ["Takeaway", s.takeaway.count, s.takeaway.revenue],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(sum)
    ws1["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan")

    // Sheet 2: Daily breakdown
    if (data.daily.length > 0) {
      const dailyRows = data.daily.map((d: any) => [d.date, d.revenue, d.expenses, d.profit, d.count])
      dailyRows.push(["TOTAL", s.totalRevenue, s.totalExpenses, s.profit, s.totalCount])
      const ws2 = XLSX.utils.aoa_to_sheet([["Tanggal", "Pendapatan", "Pengeluaran", "Profit", "Transaksi"], ...dailyRows])
      ws2["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws2, "Harian")
    }

    // Sheet 3: Menu sales
    if (data.menuSales.length > 0) {
      const menuRows = data.menuSales.map((m: any, i: number) => [i + 1, m.name, m.category, m.qty, m.revenue])
      const ws3 = XLSX.utils.aoa_to_sheet([["No", "Menu", "Kategori", "Porsi", "Pendapatan"], ...menuRows])
      ws3["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, ws3, "Penjualan Menu")
    }

    // Sheet 4: Expenses
    if (data.expenseList.length > 0) {
      const expRows = data.expenseList.map((e: any) => [e.date, e.description, e.amount, e.recordedBy])
      expRows.push(["TOTAL", "", s.totalExpenses, ""])
      const ws4 = XLSX.utils.aoa_to_sheet([["Tanggal", "Deskripsi", "Jumlah", "Dicatat Oleh"], ...expRows])
      ws4["!cols"] = [{ wch: 14 }, { wch: 35 }, { wch: 18 }, { wch: 18 }]
      XLSX.utils.book_append_sheet(wb, ws4, "Pengeluaran")
    }

    // Sheet 5: Transactions
    if (data.transactionList.length > 0) {
      const txRows = data.transactionList.map((t: any) => [t.orderNumber, t.date, t.time, t.type, t.method, t.total, t.cashier, t.items])
      const ws5 = XLSX.utils.aoa_to_sheet([["No. Pesanan", "Tanggal", "Waktu", "Tipe", "Metode", "Total", "Kasir", "Item"], ...txRows])
      ws5["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 50 }]
      XLSX.utils.book_append_sheet(wb, ws5, "Transaksi")
    }

    XLSX.writeFile(wb, `${fn}.xlsx`)
  }

  function PctBadge({ cur, prev, label }: { cur: number; prev: number; label?: string }) {
    const pct = pctChange(cur, prev)
    if (pct === null) return null
    return (
      <span className={cn("flex items-center gap-0.5 text-xs font-medium", pct >= 0 ? "text-green-600" : "text-red-600")}>
        {pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {pct >= 0 ? "+" : ""}{pct}%{label ? ` ${label}` : ""}
      </span>
    )
  }

  const s = data?.summary
  const prev = data?.previous

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Laporan</h1>
          <p className="text-sm text-muted-foreground">{getPeriodLabel()}</p>
        </div>
        {data && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </Button>
          </div>
        )}
      </div>

      {/* Period Tabs */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
          {([
            { key: "daily", label: "Harian" },
            { key: "weekly", label: "Mingguan" },
            { key: "monthly", label: "Bulanan" },
            { key: "custom", label: "Custom" },
          ] as { key: PeriodType; label: string }[]).map((t) => (
            <button key={t.key} onClick={() => setPeriod(t.key)}
              className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                period === t.key ? "bg-amber-800 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
              )}>{t.label}</button>
          ))}
        </div>

        {period === "daily" && (
          <Input type="date" value={dailyDate} max={todayStr()}
            onChange={(e) => setDailyDate(e.target.value)} className="w-44 h-9" />
        )}
        {period === "weekly" && (
          <Input type="date" value={weekDate} max={todayStr()}
            onChange={(e) => setWeekDate(e.target.value)} className="w-44 h-9" />
        )}
        {period === "monthly" && (
          <div className="flex gap-2">
            <Select value={monthMonth.toString()} onValueChange={(v) => setMonthMonth(parseInt(v))}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={monthYear.toString()} onValueChange={(v) => setMonthYear(parseInt(v))}>
              <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{[2024, 2025, 2026, 2027].map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {period === "custom" && (
          <div className="flex items-center gap-1">
            <Input type="date" value={customStart} max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)} className="w-40 h-9" />
            <span className="text-xs text-muted-foreground">—</span>
            <Input type="date" value={customEnd} min={customStart} max={todayStr()}
              onChange={(e) => setCustomEnd(e.target.value)} className="w-40 h-9" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : s ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-4">
              <p className="text-xs text-green-700 font-medium">Pendapatan</p>
              <p className="text-xl font-bold text-green-800 mt-1">{formatRupiah(s.totalRevenue)}</p>
              {prev && <PctBadge cur={s.totalRevenue} prev={prev.revenue} />}
            </div>
            <div className="rounded-xl border bg-gradient-to-br from-red-50 to-orange-50 border-red-200 p-4">
              <p className="text-xs text-red-700 font-medium">Pengeluaran</p>
              <p className="text-xl font-bold text-red-800 mt-1">{s.hasExpenses ? formatRupiah(s.totalExpenses) : formatRupiah(0)}</p>
              {!s.hasExpenses && <span className="text-xs text-amber-600">⚠ Belum dicatat</span>}
            </div>
            <div className={cn("rounded-xl border p-4", s.profit >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-300")}>
              <p className={cn("text-xs font-medium", s.profit >= 0 ? "text-blue-700" : "text-red-700")}>Profit</p>
              <p className={cn("text-xl font-bold mt-1", s.profit >= 0 ? "text-blue-800" : "text-red-800")}>{formatRupiah(s.profit)}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-muted-foreground">Transaksi</p>
              <p className="text-xl font-bold mt-1">{s.totalCount}</p>
              {prev && <PctBadge cur={s.totalCount} prev={prev.count} />}
            </div>
          </div>

          {/* Extra cards for multi-day */}
          {period !== "daily" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs text-muted-foreground">Rata-rata / Hari</p>
                <p className="text-lg font-bold mt-1">{formatRupiah(s.avgDailyRevenue)}</p>
              </div>
              {s.bestDay && (
                <div className="rounded-xl border bg-green-50 border-green-200 p-4">
                  <p className="text-xs text-green-700">📈 Hari Terbaik</p>
                  <p className="text-lg font-bold text-green-800 mt-1">{formatRupiah(s.bestDay.revenue)}</p>
                  <p className="text-xs text-green-600">{s.bestDay.dateFormatted}</p>
                </div>
              )}
              {s.worstDay && s.worstDay.date !== s.bestDay?.date && (
                <div className="rounded-xl border bg-red-50 border-red-200 p-4">
                  <p className="text-xs text-red-700">📉 Hari Terendah</p>
                  <p className="text-lg font-bold text-red-800 mt-1">{formatRupiah(s.worstDay.revenue)}</p>
                  <p className="text-xs text-red-600">{s.worstDay.dateFormatted}</p>
                </div>
              )}
            </div>
          )}

          {/* Revenue Trend (multi-day only) */}
          {data.daily.length > 1 && (
            <div className="rounded-xl border bg-white p-5">
              <h2 className="font-bold mb-4">Tren Pendapatan</h2>
              <RevenueLine data={data.daily} />
            </div>
          )}

          {/* Payment & Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-white p-5">
              <h2 className="font-bold mb-4">Metode Pembayaran</h2>
              <MethodPie data={[
                { name: "Tunai", value: s.cash.revenue },
                { name: "QRIS", value: s.qris.revenue },
              ].filter((d) => d.value > 0)} />
            </div>
            <div className="rounded-xl border bg-white p-5">
              <h2 className="font-bold mb-4">Tipe Pesanan</h2>
              <MethodPie data={[
                { name: "Dine-In", value: s.dineIn.revenue },
                { name: "Takeaway", value: s.takeaway.revenue },
              ].filter((d) => d.value > 0)} />
            </div>
          </div>

          {/* Top 10 Menu */}
          {data.menuSales.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-white p-5">
                <h2 className="font-bold mb-4">Top Menu Terlaris</h2>
                <TopItemsBar data={data.menuSales.slice(0, 10)} />
              </div>
              <div className="rounded-xl border bg-white">
                <div className="p-4 border-b"><h2 className="font-bold">Penjualan Menu</h2></div>
                <div className="max-h-[350px] overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="w-8">#</TableHead><TableHead>Menu</TableHead>
                      <TableHead className="text-center">Porsi</TableHead><TableHead className="text-right">Pendapatan</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {data.menuSales.map((m: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{m.name}</TableCell>
                          <TableCell className="text-center font-bold">{m.qty}</TableCell>
                          <TableCell className="text-right font-mono">{formatRupiah(m.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* Daily Breakdown Table (multi-day) */}
          {data.daily.length > 1 && (
            <div className="rounded-xl border bg-white">
              <div className="p-4 border-b"><h2 className="font-bold">Breakdown Harian</h2></div>
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Tanggal</TableHead><TableHead className="text-right">Pendapatan</TableHead>
                    <TableHead className="text-right">Pengeluaran</TableHead><TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-center">Trx</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.daily.map((d: any) => {
                      const isBest = s.bestDay && d.date === s.bestDay.date
                      const isWorst = s.worstDay && d.date === s.worstDay.date && d.date !== s.bestDay?.date
                      return (
                        <TableRow key={d.date} className={isBest ? "bg-green-50" : isWorst ? "bg-red-50" : ""}>
                          <TableCell className="font-medium text-sm">{d.date}</TableCell>
                          <TableCell className="text-right font-mono">{formatRupiah(d.revenue)}</TableCell>
                          <TableCell className="text-right font-mono">{formatRupiah(d.expenses)}</TableCell>
                          <TableCell className="text-right font-mono">{formatRupiah(d.profit)}</TableCell>
                          <TableCell className="text-center">{d.count}</TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow className="bg-gray-100 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right font-mono">{formatRupiah(s.totalRevenue)}</TableCell>
                      <TableCell className="text-right font-mono">{formatRupiah(s.totalExpenses)}</TableCell>
                      <TableCell className="text-right font-mono">{formatRupiah(s.profit)}</TableCell>
                      <TableCell className="text-center">{s.totalCount}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Expenses Table */}
          {data.expenseList.length > 0 && (
            <div className="rounded-xl border bg-white">
              <div className="p-4 border-b"><h2 className="font-bold">Daftar Pengeluaran</h2></div>
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Tanggal</TableHead><TableHead>Deskripsi</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead><TableHead>Dicatat</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.expenseList.map((e: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{e.date}</TableCell>
                        <TableCell>{e.description}</TableCell>
                        <TableCell className="text-right font-mono">{formatRupiah(e.amount)}</TableCell>
                        <TableCell className="text-sm">{e.recordedBy}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-100 font-bold">
                      <TableCell>TOTAL</TableCell><TableCell></TableCell>
                      <TableCell className="text-right font-mono">{formatRupiah(s.totalExpenses)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* No data */}
          {s.totalCount === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Tidak ada transaksi untuk periode ini</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
