"use client"

import { useEffect, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { TrendingUp, TrendingDown } from "lucide-react"
import { formatRupiah, cn } from "@/lib/utils"
import { cachedFetch } from "@/lib/cache"
import dynamic from "next/dynamic"

const Loader = () => <div className="h-[250px] bg-gray-50 rounded-lg animate-pulse" />

const RevenueTrend = dynamic(() => import("@/components/analytics-charts").then((m) => m.RevenueTrend), { ssr: false, loading: Loader })
const MethodPie = dynamic(() => import("@/components/analytics-charts").then((m) => m.MethodPie), { ssr: false, loading: Loader })
const TopItemsBar = dynamic(() => import("@/components/analytics-charts").then((m) => m.TopItemsBar), { ssr: false, loading: Loader })
const PeakHoursBar = dynamic(() => import("@/components/analytics-charts").then((m) => m.PeakHoursBar), { ssr: false, loading: Loader })
const DayOfWeekBar = dynamic(() => import("@/components/analytics-charts").then((m) => m.DayOfWeekBar), { ssr: false, loading: Loader })
const ProfitTrend = dynamic(() => import("@/components/analytics-charts").then((m) => m.ProfitTrend), { ssr: false, loading: Loader })
const MenuTrendLine = dynamic(() => import("@/components/analytics-charts").then((m) => m.MenuTrendLine), { ssr: false, loading: Loader })

function todayStr() { const d = new Date(); return d.toISOString().split("T")[0] }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0] }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0] }
function lastMonthStart() { const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(1); return d.toISOString().split("T")[0] }
function lastMonthEnd() { const d = new Date(); d.setDate(0); return d.toISOString().split("T")[0] }

type Preset = { label: string; start: string; end: string }
const PRESETS: Preset[] = [
  { label: "7 Hari", start: daysAgo(6), end: todayStr() },
  { label: "30 Hari", start: daysAgo(29), end: todayStr() },
  { label: "Bulan Ini", start: monthStart(), end: todayStr() },
  { label: "Bulan Lalu", start: lastMonthStart(), end: lastMonthEnd() },
  { label: "3 Bulan", start: daysAgo(89), end: todayStr() },
]

export default function AnalyticsPage() {
  const [startDate, setStartDate] = useState(daysAgo(6))
  const [endDate, setEndDate] = useState(todayStr())
  const [activePreset, setActivePreset] = useState("7 Hari")
  const [loading, setLoading] = useState(true)

  const [revenue, setRevenue] = useState<any>(null)
  const [comparison, setComparison] = useState<any>(null)
  const [menuPerf, setMenuPerf] = useState<any>(null)
  const [peakHours, setPeakHours] = useState<any[]>([])
  const [dayOfWeek, setDayOfWeek] = useState<any[]>([])
  const [profit, setProfit] = useState<any>(null)
  const [stockEff, setStockEff] = useState<any[]>([])
  const [menuTrend, setMenuTrend] = useState<any[]>([])
  const [trendMenuId, setTrendMenuId] = useState("")
  const [menuItems, setMenuItems] = useState<{ id: string; name: string }[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const data = await cachedFetch(`/api/analytics/all?startDate=${startDate}&endDate=${endDate}`, 60000)
    if (data.success) {
      setRevenue(data.data.revenue)
      setComparison(data.data.comparison)
      setMenuPerf(data.data.menuPerf)
      setPeakHours(data.data.peakHours)
      setDayOfWeek(data.data.dayOfWeek)
      setProfit(data.data.profit)
      setStockEff(data.data.stockEfficiency)
      setMenuItems(data.data.menuItemsList)
    }
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!trendMenuId) { setMenuTrend([]); return }
    fetch(`/api/analytics/menu-trend?menuItemId=${trendMenuId}&startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json()).then((d) => { if (d.success) setMenuTrend(d.data) })
  }, [trendMenuId, startDate, endDate])

  const applyPreset = (p: Preset) => { setStartDate(p.start); setEndDate(p.end); setActivePreset(p.label) }

  function PctBadge({ value }: { value: number | null }) {
    if (value === null) return null
    return (
      <span className={cn("flex items-center gap-0.5 text-xs font-medium mt-1", value >= 0 ? "text-green-600" : "text-red-600")}>
        {value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {value >= 0 ? "+" : ""}{value}%
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analitik</h1>
        <p className="text-sm text-muted-foreground">Analisis performa restoran secara mendalam</p>
      </div>

      {/* Date Range */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p)}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              activePreset === p.label ? "bg-amber-800 text-white border-amber-800" : "bg-white text-gray-600 border-gray-200 hover:border-amber-300"
            )}>{p.label}</button>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <Input type="date" value={startDate} max={endDate}
            onChange={(e) => { setStartDate(e.target.value); setActivePreset("") }} className="w-36 h-8 text-xs" />
          <span className="text-xs text-muted-foreground">—</span>
          <Input type="date" value={endDate} min={startDate} max={todayStr()}
            onChange={(e) => { setEndDate(e.target.value); setActivePreset("") }} className="w-36 h-8 text-xs" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* REVENUE OVERVIEW */}
          {revenue && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-4">
                <p className="text-xs text-green-700 font-medium">Total Pendapatan</p>
                <p className="text-xl font-bold text-green-800 mt-1">{formatRupiah(revenue.totalRevenue)}</p>
                {comparison && <PctBadge value={comparison.revenueChange} />}
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs text-muted-foreground">Total Transaksi</p>
                <p className="text-xl font-bold mt-1">{revenue.totalCount}</p>
                {comparison && <PctBadge value={comparison.countChange} />}
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs text-muted-foreground">Rata-rata / Hari</p>
                <p className="text-xl font-bold mt-1">{formatRupiah(revenue.avgRevenuePerDay)}</p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs text-muted-foreground">Rata-rata / Transaksi</p>
                <p className="text-xl font-bold mt-1">{formatRupiah(revenue.avgTransactionValue)}</p>
              </div>
            </div>
          )}

          {/* Revenue Trend */}
          {revenue?.daily?.length > 0 && (
            <div className="rounded-xl border bg-white p-5">
              <h2 className="font-bold mb-4">Tren Pendapatan</h2>
              <RevenueTrend data={revenue.daily} />
            </div>
          )}

          {/* Payment & Type Pies */}
          {revenue && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-white p-5">
                <h2 className="font-bold mb-4">Metode Pembayaran</h2>
                <MethodPie data={[
                  { name: "Tunai", value: revenue.byMethod.cash.revenue },
                  { name: "QRIS", value: revenue.byMethod.qris.revenue },
                ].filter((d: any) => d.value > 0)} />
              </div>
              <div className="rounded-xl border bg-white p-5">
                <h2 className="font-bold mb-4">Tipe Pesanan</h2>
                <MethodPie data={[
                  { name: "Dine-In", value: revenue.byType.dineIn.revenue },
                  { name: "Takeaway", value: revenue.byType.takeaway.revenue },
                  ...(revenue.byType.online?.revenue > 0 ? [{ name: "Online", value: revenue.byType.online.revenue }] : []),
                ].filter((d: any) => d.value > 0)} />
              </div>
            </div>
          )}

          {/* MENU PERFORMANCE */}
          {menuPerf && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border bg-white p-5">
                  <h2 className="font-bold mb-4">Top 10 Menu Terlaris</h2>
                  {menuPerf.bestSellers.length > 0 ? <TopItemsBar data={menuPerf.bestSellers} /> : <p className="text-sm text-muted-foreground py-8 text-center">Belum ada data</p>}
                </div>
                <div className="rounded-xl border bg-white p-5">
                  <h2 className="font-bold mb-4">Pendapatan per Kategori</h2>
                  <MethodPie data={menuPerf.categories.map((c: any) => ({ name: c.name, value: c.revenue }))} />
                </div>
              </div>

              {menuPerf.bestSellers.length > 0 && (
                <div className="rounded-xl border bg-white">
                  <div className="p-4 border-b"><h2 className="font-bold">Detail Menu Terlaris</h2></div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="w-10">#</TableHead><TableHead>Menu</TableHead><TableHead>Kategori</TableHead>
                      <TableHead className="text-center">Terjual</TableHead><TableHead className="text-right">Pendapatan</TableHead><TableHead className="text-right">%</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {menuPerf.bestSellers.map((m: any) => (
                        <TableRow key={m.rank}>
                          <TableCell className="font-bold text-amber-700">{m.rank}</TableCell>
                          <TableCell className="font-medium">{m.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{m.category}</TableCell>
                          <TableCell className="text-center font-bold">{m.qty}</TableCell>
                          <TableCell className="text-right font-mono">{formatRupiah(m.revenue)}</TableCell>
                          <TableCell className="text-right text-sm">{m.pct}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {menuPerf.worstSellers.length > 0 && (
                <div className="rounded-xl border bg-white">
                  <div className="p-4 border-b"><h2 className="font-bold text-red-700">Menu Paling Sedikit Terjual</h2></div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Menu</TableHead><TableHead className="text-center">Terjual</TableHead><TableHead className="text-right">Pendapatan</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {menuPerf.worstSellers.map((m: any, i: number) => (
                        <TableRow key={i}><TableCell className="font-medium">{m.name}</TableCell><TableCell className="text-center">{m.qty}</TableCell><TableCell className="text-right font-mono">{formatRupiah(m.revenue)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}

          {/* Menu Trend */}
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-bold">Tren Penjualan Menu</h2>
              <Select value={trendMenuId} onValueChange={setTrendMenuId}>
                <SelectTrigger className="w-52 h-8 text-sm"><SelectValue placeholder="Pilih menu..." /></SelectTrigger>
                <SelectContent>{menuItems.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {trendMenuId && menuTrend.length > 0 ? <MenuTrendLine data={menuTrend} /> : (
              <p className="text-sm text-muted-foreground py-8 text-center">{trendMenuId ? "Belum ada data" : "Pilih menu untuk melihat tren"}</p>
            )}
          </div>

          {/* TIME-BASED */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-white p-5">
              <h2 className="font-bold mb-4">Jam Ramai</h2>
              {peakHours.length > 0 ? <PeakHoursBar data={peakHours} /> : <p className="text-sm text-muted-foreground py-8 text-center">Belum ada data</p>}
            </div>
            <div className="rounded-xl border bg-white p-5">
              <h2 className="font-bold mb-4">Pendapatan per Hari</h2>
              {dayOfWeek.length > 0 ? <DayOfWeekBar data={dayOfWeek} /> : <p className="text-sm text-muted-foreground py-8 text-center">Belum ada data</p>}
            </div>
          </div>

          {/* PROFIT */}
          {profit && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-4">
                  <p className="text-xs text-green-700">Pendapatan</p>
                  <p className="text-xl font-bold text-green-800 mt-1">{formatRupiah(profit.totalRevenue)}</p>
                </div>
                <div className="rounded-xl border bg-gradient-to-br from-red-50 to-orange-50 border-red-200 p-4">
                  <p className="text-xs text-red-700">Pengeluaran</p>
                  <p className="text-xl font-bold text-red-800 mt-1">{formatRupiah(profit.totalExpenses)}</p>
                </div>
                <div className={cn("rounded-xl border p-4", profit.profit >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-300")}>
                  <p className={cn("text-xs", profit.profit >= 0 ? "text-blue-700" : "text-red-700")}>Profit</p>
                  <p className={cn("text-xl font-bold mt-1", profit.profit >= 0 ? "text-blue-800" : "text-red-800")}>{formatRupiah(profit.profit)}</p>
                </div>
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-xs text-muted-foreground">Margin Profit</p>
                  <p className="text-xl font-bold mt-1">{profit.margin}%</p>
                </div>
              </div>

              {profit.daily.length > 0 && (
                <div className="rounded-xl border bg-white p-5">
                  <h2 className="font-bold mb-4">Tren Profit</h2>
                  <ProfitTrend data={profit.daily} />
                </div>
              )}

              {profit.expenseCategories.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border bg-white p-5">
                    <h2 className="font-bold mb-4">Kategori Pengeluaran</h2>
                    <MethodPie data={profit.expenseCategories.map((c: any) => ({ name: c.name, value: c.amount }))} />
                  </div>
                  <div className="rounded-xl border bg-white p-5">
                    <h2 className="font-bold mb-4">Detail Pengeluaran</h2>
                    <div className="space-y-2">
                      {profit.expenseCategories.map((c: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{c.name}</span><span className="font-mono font-medium text-red-700">{formatRupiah(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* STOCK EFFICIENCY */}
          {stockEff.length > 0 && (
            <div className="rounded-xl border bg-white">
              <div className="p-4 border-b">
                <h2 className="font-bold">Efisiensi Stok</h2>
                <p className="text-xs text-muted-foreground">Rata-rata harian — diurutkan berdasarkan % sisa terbanyak</p>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Menu</TableHead><TableHead className="text-center">Dimasak</TableHead>
                  <TableHead className="text-center">Terjual</TableHead><TableHead className="text-center">Sisa</TableHead>
                  <TableHead className="text-center">% Sisa</TableHead><TableHead className="text-center">Restock</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {stockEff.slice(0, 15).map((s: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-center">{s.avgCooked}</TableCell>
                      <TableCell className="text-center">{s.avgSold}</TableCell>
                      <TableCell className="text-center">{s.avgWaste}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={s.wastePct > 50 ? "destructive" : s.wastePct > 25 ? "secondary" : "default"} className="text-xs">{s.wastePct}%</Badge>
                      </TableCell>
                      <TableCell className="text-center">{s.restockCount}×</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
