"use client"

import { SessionProvider, useSession } from "@/components/session-provider"
import AppHeader from "@/components/app-header"
import AppSidebar, { SidebarItem } from "@/components/app-sidebar"
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  Package,
  List,
  Receipt,
  Settings,
  QrCode,
  TrendingUp,
  ShieldCheck,
} from "lucide-react"
const DASHBOARD_NAV: SidebarItem[] = [
  { label: "Ringkasan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Transaksi", href: "/dashboard/transactions", icon: Receipt },
  { label: "Laporan", href: "/dashboard/reports", icon: BarChart3 },
  { label: "Analitik", href: "/dashboard/analytics", icon: TrendingUp },
  { label: "Persetujuan", href: "/dashboard/approvals", icon: ShieldCheck },
  { label: "Pengeluaran", href: "/dashboard/expenses", icon: Wallet },
  { label: "Kategori", href: "/dashboard/categories", icon: List },
  { label: "Stok & Menu", href: "/dashboard/menu", icon: Package },
  { label: "QR Code Meja", href: "/dashboard/qr-codes", icon: QrCode },
  { label: "Pengaturan", href: "/dashboard/settings", icon: Settings },
]

function DashboardShell({ children }: { children: React.ReactNode }) {
  const session = useSession()
  return (
    <div className="h-screen flex flex-col">
      <AppHeader userName={session.name} role={session.role} />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar items={DASHBOARD_NAV} />
        <main className="flex-1 overflow-auto bg-gray-50 p-4">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DashboardShell>{children}</DashboardShell>
    </SessionProvider>
  )
}
