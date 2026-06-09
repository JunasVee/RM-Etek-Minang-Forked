"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "@/components/session-provider"
import { formatRupiah } from "@/lib/utils"
import { cachedFetch } from "@/lib/cache"
import {
  TrendingUp, TrendingDown, Receipt, Banknote, BarChart3, Wallet,
} from "lucide-react"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import dynamic from "next/dynamic"

const WeeklyChart = dynamic(
  () => import("recharts").then((mod) => {
    const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } = mod
    return function Chart({ data }: { data: any[] }) {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000)}rb` : v.toString()} />
            <Tooltip formatter={(value: number) => formatRupiah(value)} />
            <Legend />
            <Line type="monotone" dataKey="revenue" name="Pendapatan" stroke="#b45309" strokeWidth={2.5} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="profit" name="Profit" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      )
    }
  }),
  { ssr: false, loading: () => <div className="h-[280px] bg-gray-50 rounded-lg animate-pulse" /> }
)

type Profit = {
  totalRevenue: number; revenueCount: number;
  totalExpenses: number; expenseCount: number;
  profit: number; hasExpenses: boolean
}
type WeeklyDay = {
  date: string; dateISO: string;
  revenue: number; expenses: number; profit: number; txCount: number
}

export default function DashboardPage() {
  const session = useSession()
  const [today, setToday] = useState<Profit | null>(null)
  const [yesterday, setYesterday] = useState<Profit | null>(null)
  const [weekly, setWeekly] = useState<WeeklyDay[]>([])
  const [loading, setLoading] = useState(true)

  const todayISO = new Date().toISOString().split("T")[0]
  const yestDate = new Date(); yestDate.setDate(yestDate.getDate() - 1)
  const yestISO = yestDate.toISOString().split("T")[0]

  const fetchData = useCallback(async () => {
    setLoading(true)
    const data = await cachedFetch("/api/dashboard/summary", 30000)
    if (data.success) {
      const d = data.data
      setToday({
        totalRevenue: d.today.revenue,
        revenueCount: d.today.count,
        totalExpenses: d.today.expenses,
        expenseCount: d.today.hasExpenses ? 1 : 0,
        profit: d.today.profit,
        hasExpenses: d.today.hasExpenses,
      })
      setYesterday({
        totalRevenue: d.yesterdayRevenue,
        revenueCount: 0, totalExpenses: 0, expenseCount: 0, profit: 0, hasExpenses: false,
      })
      setWeekly(d.weekly.map((w: any) => ({
        date: w.date, dateISO: "", revenue: w.revenue, expenses: 0, profit: w.profit, txCount: 0,
      })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const revDiff = today && yesterday && yesterday.totalRevenue > 0
    ? Math.round(((today.totalRevenue - yesterday.totalRevenue) / yesterday.totalRevenue) * 100) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Selamat datang, {session.name}.{" "}
          {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : today && (
        <>
          {/* Profit Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Revenue */}
            <div className="rounded-xl border bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-5">
              <div className="flex items-center gap-2 text-green-700 mb-1">
                <Banknote className="h-4 w-4" />
                <span className="text-xs font-medium">Pendapatan</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-green-800">{formatRupiah(today.totalRevenue)}</p>
              <p className="text-xs text-green-600 mt-1">{today.revenueCount} transaksi</p>
              {revDiff !== null && (
                <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${revDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {revDiff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {revDiff >= 0 ? "+" : ""}{revDiff}% dari kemarin
                </div>
              )}
            </div>

            {/* Expenses */}
            <div className="rounded-xl border bg-gradient-to-br from-red-50 to-orange-50 border-red-200 p-5">
              <div className="flex items-center gap-2 text-red-700 mb-1">
                <Wallet className="h-4 w-4" />
                <span className="text-xs font-medium">Pengeluaran</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-red-800">{formatRupiah(today.totalExpenses)}</p>
              <p className="text-xs text-red-600 mt-1">{today.expenseCount} entri</p>
              {!today.hasExpenses && (
                <p className="text-xs text-orange-600 mt-1">⚠️ Belum dicatat</p>
              )}
            </div>

            {/* Profit */}
            <div className={cn(
              "rounded-xl border p-5",
              today.profit >= 0
                ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
                : "bg-gradient-to-br from-red-50 to-pink-50 border-red-300"
            )}>
              <div className={cn("flex items-center gap-2 mb-1", today.profit >= 0 ? "text-blue-700" : "text-red-700")}>
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs font-medium">Profit</span>
              </div>
              <p className={cn("text-xl md:text-2xl font-bold", today.profit >= 0 ? "text-blue-800" : "text-red-800")}>
                {formatRupiah(today.profit)}
              </p>
              {!today.hasExpenses && (
                <p className="text-xs text-orange-600 mt-1">= pendapatan (belum ada pengeluaran)</p>
              )}
            </div>

            {/* Avg */}
            <div className="rounded-xl border bg-white p-5">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Receipt className="h-4 w-4" />
                <span className="text-xs font-medium">Rata-rata / Transaksi</span>
              </div>
              <p className="text-xl md:text-2xl font-bold">
                {today.revenueCount > 0 ? formatRupiah(Math.round(today.totalRevenue / today.revenueCount)) : "Rp 0"}
              </p>
            </div>
          </div>

          {/* Weekly Chart */}
          <div className="rounded-xl border bg-white p-5">
            <h2 className="font-bold mb-4">Pendapatan & Profit 7 Hari Terakhir</h2>
            <WeeklyChart data={weekly} />
          </div>

          {/* Weekly Table */}
          <div className="rounded-xl border bg-white">
            <div className="p-4 border-b">
              <h2 className="font-bold">Ringkasan 7 Hari</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-center">Transaksi</TableHead>
                  <TableHead className="text-right">Pendapatan</TableHead>
                  <TableHead className="text-right">Pengeluaran</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weekly.map((day) => (
                  <TableRow key={day.dateISO}>
                    <TableCell className="font-medium">{day.date}</TableCell>
                    <TableCell className="text-center">{day.txCount}</TableCell>
                    <TableCell className="text-right font-mono text-green-700">{formatRupiah(day.revenue)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{formatRupiah(day.expenses)}</TableCell>
                    <TableCell className={cn("text-right font-mono font-bold", day.profit >= 0 ? "text-blue-700" : "text-red-700")}>
                      {formatRupiah(day.profit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
