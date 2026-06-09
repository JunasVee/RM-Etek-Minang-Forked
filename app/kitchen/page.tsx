"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/components/session-provider"
import { supabase } from "@/lib/supabase"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

/* ---------- Types ---------- */
type Category = { name: string }
type MenuItemInfo = {
  id: string; name: string; currentStock: number;
  initialStock: number; minThreshold: number;
  category: Category
}
type Notification = {
  id: string; menuItemId: string; isResolved: boolean;
  createdAt: string;
  menuItem: MenuItemInfo
}
type StockItem = {
  id: string; name: string; currentStock: number;
  initialStock: number; categoryId: string;
  category: { id: string; name: string }
}

/* ---------- Beep Sound ---------- */
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    osc.type = "square"
    gain.gain.value = 0.3
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
    setTimeout(() => {
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.value = 1000
      osc2.type = "square"
      gain2.gain.value = 0.3
      osc2.start()
      osc2.stop(ctx.currentTime + 0.2)
    }, 200)
  } catch {}
}

/* ---------- Operating Hours ---------- */
function isNightMode(): boolean {
  const h = new Date().getHours()
  return h < 8 || h >= 21
}

/* ---------- Component ---------- */
export default function KitchenPage() {
  const session = useSession()
  const router = useRouter()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [menuItems, setMenuItems] = useState<StockItem[]>([])
  const [clock, setClock] = useState(new Date())
  const [nightMode, setNightMode] = useState(isNightMode())
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())

  // Restock dialog
  const [restockItem, setRestockItem] = useState<StockItem | null>(null)
  const [restockQty, setRestockQty] = useState("")
  const [restocking, setRestocking] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<NodeJS.Timeout | undefined>(undefined)

  /* ---------- Clock ---------- */
  useEffect(() => {
    const interval = setInterval(() => {
      setClock(new Date())
      setNightMode(isNightMode())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  /* ---------- Fetch initial data ---------- */
  const fetchData = useCallback(async () => {
    const [notifRes, stockRes] = await Promise.all([
      fetch("/api/kitchen/notifications"),
      fetch("/api/stock"),
    ])
    const [notifData, stockData] = await Promise.all([notifRes.json(), stockRes.json()])
    if (notifData.success) setNotifications(notifData.data)
    if (stockData.success) setMenuItems(stockData.data)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ---------- Supabase Realtime ---------- */
  useEffect(() => {
    // Subscribe to RestockNotification changes
    const notifChannel = supabase
      .channel("kitchen-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "RestockNotification" },
        () => {
          // Refetch notifications on any change
          fetch("/api/kitchen/notifications")
            .then((r) => r.json())
            .then((data) => {
              if (data.success) {
                const newNotifs: Notification[] = data.data
                // Detect new notifications for beep
                setNotifications((prev) => {
                  const prevIds = new Set(prev.map((n) => n.id))
                  const newOnes = newNotifs.filter((n) => !prevIds.has(n.id))
                  if (newOnes.length > 0) {
                    playBeep()
                    // Flash new cards
                    const ids = new Set(newOnes.map((n) => n.id))
                    setFlashIds(ids)
                    setTimeout(() => setFlashIds(new Set()), 2000)
                  }
                  return newNotifs
                })
              }
            })
        }
      )
      .subscribe()

    // Subscribe to MenuItem stock changes
    const stockChannel = supabase
      .channel("kitchen-stock")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "MenuItem" },
        () => {
          // Refetch stock data
          fetch("/api/stock")
            .then((r) => r.json())
            .then((data) => {
              if (data.success) setMenuItems(data.data)
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(notifChannel)
      supabase.removeChannel(stockChannel)
    }
  }, [])

  // Fallback polling every 20 seconds (in case Realtime fails)
  useEffect(() => {
    const interval = setInterval(fetchData, 20000)
    return () => clearInterval(interval)
  }, [fetchData])

  /* ---------- Restock handler ---------- */
  const handleRestock = async () => {
    if (!restockItem) return
    const qty = parseInt(restockQty)
    if (!qty || qty < 1) return

    setRestocking(true)
    const res = await fetch(`/api/stock/${restockItem.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: qty,
        note: `Ditambah oleh ${session.name}`,
      }),
    })
    const data = await res.json()
    if (data.success) {
      const name = restockItem.name
      setRestockItem(null)
      setRestockQty("")
      fetchData()

      // Show toast
      setToast(`✅ ${name} +${qty} porsi`)
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 3000)
    } else {
      alert(data.error)
    }
    setRestocking(false)
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const timeStr = clock.toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white select-none">
      {/* ===== Night Mode Banner ===== */}
      {nightMode && (
        <div className="bg-indigo-900 text-indigo-200 text-center py-2 sm:py-3 text-sm sm:text-lg font-medium px-3">
          🌙 Mode Malam — Notifikasi restock dinonaktifkan
        </div>
      )}

      {/* ===== Header ===== */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-gray-800 border-b border-gray-700">
        <div className="min-w-0">
          <h1 className="text-base sm:text-2xl font-bold tracking-tight truncate">
            🍳 <span className="hidden sm:inline">DAPUR — </span>RM. ETEK MINANG
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
            Halo, {session.name}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-6 shrink-0">
          <span className="text-lg sm:text-3xl font-mono font-bold text-amber-400">
            {timeStr}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs sm:text-sm"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <div className="flex flex-col lg:flex-row gap-4 p-3 sm:p-4 lg:h-[calc(100vh-80px)]">
        {/* ----- Section A: Perlu Dimasak ----- */}
        <div className="lg:w-[45%] flex flex-col min-h-0">
          <h2 className="text-lg sm:text-xl font-bold text-red-400 mb-3 shrink-0 flex items-center gap-2">
            🔴 Perlu Dimasak
            {notifications.length > 0 && (
              <span className="bg-red-600 text-white text-sm px-3 py-0.5 rounded-full font-bold">
                {notifications.length}
              </span>
            )}
          </h2>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[40vh] lg:max-h-none">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10 sm:py-16">
                <span className="text-5xl sm:text-6xl mb-4">✅</span>
                <p className="text-xl sm:text-2xl font-bold text-green-400">Semua stok aman</p>
                <p className="text-gray-500 mt-2 text-base sm:text-lg">Tidak ada yang perlu dimasak</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isNew = flashIds.has(notif.id)
                const elapsed = Math.floor(
                  (Date.now() - new Date(notif.createdAt).getTime()) / 60000
                )
                const timeLabel = elapsed < 1
                  ? "Baru saja"
                  : elapsed < 60
                  ? `${elapsed} menit lalu`
                  : `${Math.floor(elapsed / 60)} jam lalu`

                return (
                  <div
                    key={notif.id}
                    className={cn(
                      "rounded-2xl border-2 p-4 sm:p-5 transition-all duration-500",
                      isNew
                        ? "border-red-400 bg-red-900/50 animate-pulse"
                        : "border-red-800 bg-red-950/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xl sm:text-3xl font-bold leading-tight truncate">
                          {notif.menuItem.name}
                        </p>
                        <p className="text-gray-400 text-xs sm:text-sm mt-1">
                          {notif.menuItem.category.name}
                        </p>
                      </div>
                      <span className="text-2xl sm:text-4xl shrink-0">🔴</span>
                    </div>
                    <div className="flex items-center justify-between mt-3 sm:mt-4">
                      <p className="text-base sm:text-xl font-semibold text-red-300">
                        Sisa: {notif.menuItem.currentStock} porsi
                      </p>
                      <p className="text-sm text-gray-500">{timeLabel}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ----- Section B: Tambah Stok ----- */}
        <div className="lg:w-[55%] flex flex-col min-h-0">
          <h2 className="text-lg sm:text-xl font-bold text-green-400 mb-3 shrink-0">
            ➕ Tambah Stok
          </h2>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {menuItems.map((item) => {
                const pct = item.initialStock > 0
                  ? (item.currentStock / item.initialStock) * 100 : 0
                const isLow = pct <= 25
                const isOut = item.currentStock === 0

                return (
                  <button
                    key={item.id}
                    onClick={() => { setRestockItem(item); setRestockQty("") }}
                    className={cn(
                      "rounded-xl p-3 sm:p-4 text-left transition-all active:scale-[0.96] min-h-[70px] sm:min-h-[80px]",
                      "border-2",
                      isOut
                        ? "bg-gray-800 border-gray-700 opacity-50"
                        : isLow
                        ? "bg-red-950/30 border-red-800 hover:border-red-500"
                        : "bg-gray-800 border-gray-700 hover:border-green-600"
                    )}
                  >
                    <p className="font-bold text-sm sm:text-base leading-tight truncate">
                      {item.name}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={cn(
                        "text-lg font-bold",
                        isOut ? "text-gray-500" :
                        isLow ? "text-red-400" : "text-green-400"
                      )}>
                        {isOut ? "HABIS" : `${item.currentStock}`}
                      </span>
                      <span className="text-xs text-gray-500">
                        /{item.initialStock}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Restock Dialog (Full-screen overlay, very simple) ===== */}
      {restockItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-5 sm:p-6 space-y-4 sm:space-y-5 border-2 border-gray-600 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold">{restockItem.name}</p>
              <p className="text-gray-400 mt-1 text-sm sm:text-base">
                Stok saat ini: <span className="text-white font-bold text-lg sm:text-xl">{restockItem.currentStock}</span> porsi
              </p>
            </div>

            {/* Question */}
            <p className="text-center text-base sm:text-lg text-gray-300">
              Berapa porsi yang sudah dimasak?
            </p>

            {/* Quick buttons */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {[5, 10, 15, 20].map((q) => (
                <button
                  key={q}
                  onClick={() => setRestockQty(q.toString())}
                  className={cn(
                    "py-3 sm:py-4 rounded-xl text-lg sm:text-xl font-bold transition-all active:scale-95 border-2",
                    parseInt(restockQty) === q
                      ? "bg-green-600 border-green-500 text-white"
                      : "bg-gray-700 border-gray-600 text-gray-200 hover:border-green-500"
                  )}
                >
                  +{q}
                </button>
              ))}
            </div>

            {/* Manual input */}
            <input
              type="number"
              inputMode="numeric"
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value.replace(/\D/g, ""))}
              placeholder="Ketik jumlah..."
              className="w-full h-14 sm:h-16 bg-gray-700 border-2 border-gray-600 rounded-xl text-center text-2xl sm:text-3xl font-bold text-white placeholder:text-gray-500 focus:outline-none focus:border-green-500"
            />

            {/* Result preview */}
            {parseInt(restockQty) > 0 && (
              <div className="bg-green-900/40 border border-green-700 rounded-xl p-3 sm:p-4 text-center">
                <p className="text-gray-400 text-xs sm:text-sm">Stok setelah ditambah:</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-400">
                  {restockItem.currentStock + (parseInt(restockQty) || 0)} porsi
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => { setRestockItem(null); setRestockQty("") }}
                className="flex-1 py-3 sm:py-4 rounded-xl bg-gray-700 text-gray-300 font-bold text-base sm:text-lg hover:bg-gray-600 active:scale-[0.97] border-2 border-gray-600"
              >
                Batal
              </button>
              <button
                onClick={handleRestock}
                disabled={restocking || !restockQty || parseInt(restockQty) < 1}
                className="flex-1 py-3 sm:py-4 rounded-xl bg-green-600 text-white font-bold text-base sm:text-lg hover:bg-green-700 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed border-2 border-green-500"
              >
                {restocking ? "Menambah..." : "✅ Tambah"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Toast ===== */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl text-base sm:text-xl font-bold shadow-2xl animate-bounce max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  )
}
