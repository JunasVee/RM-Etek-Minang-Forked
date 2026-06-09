"use client"

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts"
import { formatRupiah } from "@/lib/utils"

const COLORS = ["#b45309", "#d97706", "#f59e0b", "#fbbf24", "#92400e", "#78350f", "#451a03", "#ea580c", "#c2410c", "#7c2d12"]
const PIE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626"]

export function RevenueTrend({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}jt` : v >= 1000 ? `${(v/1000)}rb` : v.toString()} />
        <Tooltip formatter={(v) => formatRupiah(Number(v))} />
        <Line type="monotone" dataKey="revenue" name="Pendapatan" stroke="#b45309" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function MethodPie({ data }: { data: any[] }) {
  if (data.length === 0) return <p className="text-sm text-gray-400 py-8 text-center">Belum ada data</p>
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85}
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => formatRupiah(Number(v))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function TopItemsBar({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [`${Number(v)} porsi`, "Terjual"] as [string, string]} />
        <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PeakHoursBar({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey="avgCount" name="Rata-rata Transaksi" fill="#d97706" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DayOfWeekBar({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000)}rb` : v.toString()} />
        <Tooltip formatter={(v) => formatRupiah(Number(v))} />
        <Bar dataKey="avgRevenue" name="Rata-rata Pendapatan" fill="#b45309" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ProfitTrend({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}jt` : v >= 1000 ? `${(v/1000)}rb` : v.toString()} />
        <Tooltip formatter={(v) => formatRupiah(Number(v))} />
        <Legend />
        <Line type="monotone" dataKey="revenue" name="Pendapatan" stroke="#16a34a" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="expenses" name="Pengeluaran" stroke="#dc2626" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="profit" name="Profit" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function MenuTrendLine({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Line type="monotone" dataKey="qty" name="Porsi Terjual" stroke="#b45309" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
