"use client"

import { useRouter } from "next/navigation"
import { LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import PrinterStatus from "@/components/printer-status"

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Pemilik",
  KASIR: "Kasir",
  WAITER: "Pelayan",
  DAPUR: "Dapur",
}

function getTodayString() {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })
}

export default function AppHeader({ userName, role }: { userName: string; role: string }) {
  const router = useRouter()
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-amber-900 hidden sm:inline">RM. Etek Minang</span>
        <span className="text-lg sm:hidden">🍛</span>
        <span className="text-muted-foreground text-sm hidden md:inline">{getTodayString()}</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Printer status — only for KASIR & OWNER (roles that print) */}
        {(role === "KASIR" || role === "OWNER" || role === "WAITER") && (
          <PrinterStatus />
        )}

        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{userName}</span>
          <Badge variant="secondary" className="text-xs">{ROLE_LABELS[role] || role}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-red-600">
          <LogOut className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Keluar</span>
        </Button>
      </div>
    </header>
  )
}
