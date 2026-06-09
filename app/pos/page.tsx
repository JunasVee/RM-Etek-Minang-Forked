"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSession } from "@/components/session-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Plus, Minus, Trash2, ShoppingCart, X, ClipboardList,
  UtensilsCrossed, Package as PackageIcon, Lock, Users,
} from "lucide-react"
import { formatRupiah, cn } from "@/lib/utils"
import { cachedFetch, invalidateCache } from "@/lib/cache"
import PaymentDialog from "@/components/payment-dialog"
import ModRequestDialog from "@/components/mod-request-dialog"
import SplitBillDialog from "@/components/split-bill-dialog"

/* ---------- types ---------- */
type Category = { id: string; name: string; sortOrder: number }
type MenuItem = {
  id: string; name: string; price: number;
  currentStock: number; initialStock: number;
  minThreshold: number; isActive: boolean;
  categoryId: string; category: Category
}
type CartItem = {
  menuItemId: string; name: string;
  price: number; quantity: number; stock: number
}
type OrderFromAPI = {
  id: string; orderNumber: string; type: string;
  status: string; tableNumber: number | null;
  createdAt: string;
  items: {
    id: string; menuItemId: string; quantity: number;
    priceAtOrder: number; menuItem: { name: string }
  }[]
  createdBy: { name: string }
  transactions: {
    id: string; totalAmount: number; paymentMethod: string;
    splitGroup: string | null; splitLabel: string | null;
    cashReceived: number | null; changeAmount: number | null;
  }[]
}

export default function PosPage() {
  const session = useSession()

  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [activeCat, setActiveCat] = useState<string>("all")

  const [cart, setCart] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN")
  const [tableNumber, setTableNumber] = useState("")

  const [openOrders, setOpenOrders] = useState<OrderFromAPI[]>([])
  const [showOpenOrders, setShowOpenOrders] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)
  const flashTimer = useRef<NodeJS.Timeout>()

  // Payment state
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<{
    id: string; orderNumber: string; type: string;
    tableNumber?: number | null;
    items: { menuItemId: string; name: string; price: number; quantity: number }[]
  } | null>(null)

  // Mod request state
  const [modRequestOpen, setModRequestOpen] = useState(false)
  const [modRequestOrder, setModRequestOrder] = useState<{
    id: string; orderNumber: string;
    items: { menuItemId: string; name: string; quantity: number }[]
  } | null>(null)

  // Split bill state
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitOrder, setSplitOrder] = useState<{
    id: string; orderNumber: string;
    items: { menuItemId: string; name: string; price: number; quantity: number }[]
    existingPayments?: { id: string; totalAmount: number; paymentMethod: string;
      splitGroup: string | null; splitLabel: string | null;
      cashReceived: number | null; changeAmount: number | null }[]
  } | null>(null)

  const isRestricted = session.role !== "OWNER" // WAITER & KASIR need approval
  const isEditingExisting = !!editingOrderId

  /* ---------- fetch data ---------- */
  const fetchInit = useCallback(async () => {
    const data = await cachedFetch("/api/pos/init", 15000)
    if (data.success) {
      setCategories(data.data.categories)
      setMenuItems(data.data.menuItems.filter((m: MenuItem) => m.isActive))
      setOpenOrders(data.data.openOrders)
    }
  }, [])

  const fetchMenu = useCallback(async () => {
    invalidateCache("/api/pos")
    const data = await cachedFetch("/api/pos/init", 0)
    if (data.success) setMenuItems(data.data.menuItems.filter((m: MenuItem) => m.isActive))
  }, [])

  const fetchOpenOrders = useCallback(async () => {
    invalidateCache("/api/pos")
    const data = await cachedFetch("/api/pos/init", 0)
    if (data.success) setOpenOrders(data.data.openOrders)
  }, [])

  useEffect(() => { fetchInit() }, [fetchInit])

  /* ---------- cart logic ---------- */
  const filteredMenu = activeCat === "all"
    ? menuItems
    : menuItems.filter((m) => m.categoryId === activeCat)

  const addToCart = (item: MenuItem) => {
    if (item.currentStock <= 0) return
    const existing = cart.find((c) => c.menuItemId === item.id)
    const currentQty = existing ? existing.quantity : 0
    if (currentQty >= item.currentStock) return

    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menuItemId === item.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 }
        return updated
      }
      return [...prev, {
        menuItemId: item.id, name: item.name,
        price: item.price, quantity: 1, stock: item.currentStock,
      }]
    })

    setFlashId(item.id)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlashId(null), 400)
  }

  const updateQty = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.menuItemId !== menuItemId) return c
        const newQty = c.quantity + delta
        if (newQty <= 0 || newQty > c.stock) return c
        return { ...c, quantity: newQty }
      })
    )
  }

  const removeItem = (menuItemId: string) => {
    setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId))
  }

  const clearCart = () => {
    setCart([])
    setEditingOrderId(null)
    setTableNumber("")
    setOrderType("DINE_IN")
  }

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0)

  /* ---------- save order ---------- */
  const handleSaveOrder = async (payNow = false) => {
    if (cart.length === 0) return
    setSaving(true)

    const items = cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity }))

    try {
      let res: Response
      if (editingOrderId) {
        res = await fetch(`/api/orders/${editingOrderId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        })
      } else {
        res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: orderType,
            tableNumber: tableNumber ? parseInt(tableNumber) : null,
            createdById: session.userId,
            items,
          }),
        })
      }

      const data = await res.json()
      if (data.success) {
        const savedOrder = data.data
        if (payNow) {
          // Open payment dialog with the saved order
          setPaymentOrder({
            id: savedOrder.id,
            orderNumber: savedOrder.orderNumber,
            type: savedOrder.type || orderType,
            tableNumber: savedOrder.tableNumber ?? (tableNumber ? parseInt(tableNumber) : null),
            items: savedOrder.items.map((i: any) => ({
              menuItemId: i.menuItemId,
              name: i.menuItem?.name || cart.find((c) => c.menuItemId === i.menuItemId)?.name || "",
              price: i.priceAtOrder,
              quantity: i.quantity,
            })),
          })
          clearCart()
          fetchMenu()
          fetchOpenOrders()
          setPaymentOpen(true)
        } else {
          clearCart()
          fetchMenu()
          fetchOpenOrders()
        }
      } else {
        alert(data.error)
      }
    } catch {
      alert("Gagal menyimpan pesanan")
    }
    setSaving(false)
  }

  /* ---------- open payment for existing order ---------- */
  const openPaymentForOrder = (order: OrderFromAPI) => {
    const orderTotal = order.items.reduce((s, i) => s + i.priceAtOrder * i.quantity, 0)
    setPaymentOrder({
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      tableNumber: order.tableNumber,
      items: order.items.map((i) => ({
        menuItemId: i.menuItemId,
        name: i.menuItem.name,
        price: i.priceAtOrder,
        quantity: i.quantity,
      })),
    })
    setShowOpenOrders(false)
    setPaymentOpen(true)
  }

  /* ---------- load existing order ---------- */
  const loadOrder = (order: OrderFromAPI) => {
    setEditingOrderId(order.id)
    setOrderType(order.type as "DINE_IN" | "TAKEAWAY")
    setTableNumber(order.tableNumber?.toString() || "")
    setCart(
      order.items.map((i) => {
        const menu = menuItems.find((m) => m.id === i.menuItemId)
        return {
          menuItemId: i.menuItemId, name: i.menuItem.name,
          price: i.priceAtOrder, quantity: i.quantity,
          stock: menu ? menu.currentStock + i.quantity : i.quantity,
        }
      })
    )
    setShowOpenOrders(false)
  }

  /* ---------- cancel order ---------- */
  const cancelOrder = async (orderId: string) => {
    if (isRestricted) {
      alert("Perlu persetujuan Owner untuk membatalkan pesanan")
      return
    }
    if (!confirm("Yakin ingin membatalkan pesanan ini? Stok akan dikembalikan.")) return
    const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "PUT" })
    const data = await res.json()
    if (data.success) {
      if (editingOrderId === orderId) clearCart()
      fetchMenu()
      fetchOpenOrders()
    } else {
      alert(data.error)
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-0 -m-4">
      {/* ===== LEFT: Menu Grid ===== */}
      <div className="flex-1 flex flex-col min-w-0 border-r">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 p-3 pb-2 border-b bg-white overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveCat("all")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              activeCat === "all"
                ? "bg-amber-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            Semua
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                activeCat === cat.id
                  ? "bg-amber-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {cat.name}
            </button>
          ))}

          <div className="ml-auto pl-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOpenOrders(true)}
              className="relative"
            >
              <ClipboardList className="h-4 w-4 mr-1" />
              Pesanan
              {openOrders.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {openOrders.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-auto p-3 bg-gray-50">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {filteredMenu.map((item) => {
              const outOfStock = item.currentStock <= 0
              const inCart = cart.find((c) => c.menuItemId === item.id)
              const isFlashing = flashId === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  disabled={outOfStock}
                  className={cn(
                    "relative flex flex-col rounded-xl border p-3 text-left transition-all",
                    outOfStock
                      ? "bg-gray-100 opacity-50 cursor-not-allowed border-gray-200"
                      : "bg-white hover:shadow-md hover:border-amber-300 active:scale-[0.97] cursor-pointer border-gray-200",
                    isFlashing && "ring-2 ring-green-400 bg-green-50"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-2 right-2 text-xs font-bold rounded-full px-2 py-0.5",
                      outOfStock
                        ? "bg-red-100 text-red-600"
                        : item.currentStock <= item.initialStock * item.minThreshold
                        ? "bg-orange-100 text-orange-700"
                        : "bg-green-100 text-green-700"
                    )}
                  >
                    {item.currentStock}
                  </span>

                  {inCart && (
                    <span className="absolute top-2 left-2 bg-amber-800 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                      {inCart.quantity}
                    </span>
                  )}

                  <span className="font-semibold text-sm mt-1 pr-8 leading-tight">
                    {item.name}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {item.category.name}
                  </span>
                  <span className="font-bold text-amber-800 mt-auto pt-2 text-sm">
                    {formatRupiah(item.price)}
                  </span>
                </button>
              )
            })}
          </div>

          {filteredMenu.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <PackageIcon className="h-8 w-8 mb-2" />
              <p className="text-sm">Tidak ada menu di kategori ini</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== RIGHT: Order Panel ===== */}
      <div className="w-[360px] xl:w-[400px] flex flex-col bg-white shrink-0">
        <div className="p-3 border-b space-y-3 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg flex-1">
              {editingOrderId ? "Edit Pesanan" : "Pesanan Baru"}
            </h2>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" /> Bersihkan
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setOrderType("DINE_IN")}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                orderType === "DINE_IN"
                  ? "bg-amber-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <UtensilsCrossed className="h-4 w-4" /> Dine-In
            </button>
            <button
              onClick={() => setOrderType("TAKEAWAY")}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                orderType === "TAKEAWAY"
                  ? "bg-amber-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <PackageIcon className="h-4 w-4" /> Takeaway
            </button>
          </div>

          {orderType === "DINE_IN" && (
            <Input
              type="number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="Nomor meja (opsional)"
              className="h-9"
              min={1}
            />
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Belum ada item</p>
              <p className="text-xs mt-1">Ketuk menu di sebelah kiri untuk menambah</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex items-start gap-2 p-2.5 rounded-lg border bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRupiah(item.price)} × {item.quantity}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        if (isRestricted && isEditingExisting) {
                          setModRequestOrder({
                            id: editingOrderId!,
                            orderNumber: "Pesanan",
                            items: cart.map((c) => ({ menuItemId: c.menuItemId, name: c.name, quantity: c.quantity })),
                          })
                          setModRequestOpen(true)
                          return
                        }
                        updateQty(item.menuItemId, -1)
                      }}
                      className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center hover:bg-gray-100 active:scale-95"
                    >
                      {isRestricted && isEditingExisting ? <Lock className="h-3 w-3 text-amber-500" /> : <Minus className="h-3.5 w-3.5" />}
                    </button>
                    <span className="w-8 text-center text-sm font-bold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.menuItemId, 1)}
                      disabled={item.quantity >= item.stock}
                      className="h-8 w-8 rounded-lg bg-white border flex items-center justify-center hover:bg-gray-100 active:scale-95 disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="text-right shrink-0 w-20">
                    <p className="text-sm font-bold">
                      {formatRupiah(item.price * item.quantity)}
                    </p>
                    <button
                      onClick={() => {
                        if (isRestricted && isEditingExisting) {
                          setModRequestOrder({
                            id: editingOrderId!,
                            orderNumber: "Pesanan",
                            items: cart.map((c) => ({ menuItemId: c.menuItemId, name: c.name, quantity: c.quantity })),
                          })
                          setModRequestOpen(true)
                          return
                        }
                        removeItem(item.menuItemId)
                      }}
                      className="text-red-400 hover:text-red-600 mt-0.5"
                    >
                      {isRestricted && isEditingExisting ? <Lock className="h-3.5 w-3.5 text-amber-500" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total & Actions */}
        {cart.length > 0 && (
          <div className="border-t p-3 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {cart.reduce((s, c) => s + c.quantity, 0)} item
              </span>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">TOTAL</p>
                <p className="text-2xl font-bold text-amber-900">
                  {formatRupiah(total)}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleSaveOrder(false)}
                disabled={saving}
                variant="outline"
                className="flex-1 h-12 font-semibold"
              >
                {saving ? "Menyimpan..." : editingOrderId ? "Update Pesanan" : "Simpan (OPEN)"}
              </Button>
              <Button
                onClick={() => handleSaveOrder(true)}
                disabled={saving}
                className="flex-1 h-12 font-semibold bg-green-700 hover:bg-green-800"
              >
                Bayar Sekarang
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Open Orders Dialog ===== */}
      <Dialog open={showOpenOrders} onOpenChange={setShowOpenOrders}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pesanan Aktif Hari Ini</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-6 px-6">
            {openOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Tidak ada pesanan aktif
              </p>
            ) : (
              <div className="space-y-2">
                {openOrders.map((order) => {
                  const orderTotal = order.items.reduce(
                    (s, i) => s + i.priceAtOrder * i.quantity, 0
                  )
                  const isPartial = order.status === "PARTIALLY_PAID"
                  const paidAmount = order.transactions?.reduce((s, t) => s + t.totalAmount, 0) || 0
                  const paidLabels = order.transactions?.filter((t) => t.splitLabel).map((t) => t.splitLabel) || []
                  return (
                    <div
                      key={order.id}
                      className={cn("flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50", isPartial && "border-yellow-300 bg-yellow-50")}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm">
                            {order.orderNumber}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {order.type === "DINE_IN" ? "Dine-In" : "Takeaway"}
                          </Badge>
                          {order.tableNumber && (
                            <Badge variant="outline" className="text-xs">
                              Meja {order.tableNumber}
                            </Badge>
                          )}
                          {isPartial && (
                            <Badge className="text-xs bg-yellow-500 text-white">
                              ⏳ {paidLabels.length} sudah bayar
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {order.items.length} item · {formatRupiah(orderTotal)} ·{" "}
                          {new Date(order.createdAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                        {isPartial && (
                          <p className="text-xs text-yellow-700 mt-0.5">
                            Dibayar: {formatRupiah(paidAmount)} · Sisa: {formatRupiah(orderTotal - paidAmount)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                        {isPartial ? (
                          /* PARTIALLY_PAID: show "Lanjutkan Pembayaran" */
                          <Button
                            size="sm"
                            className="bg-yellow-600 hover:bg-yellow-700 text-white"
                            onClick={() => {
                              setSplitOrder({
                                id: order.id,
                                orderNumber: order.orderNumber,
                                items: order.items.map((i) => ({
                                  menuItemId: i.menuItemId,
                                  name: i.menuItem.name,
                                  price: i.priceAtOrder,
                                  quantity: i.quantity,
                                })),
                                existingPayments: order.transactions?.filter((t) => t.splitLabel) || [],
                              })
                              setSplitOpen(true)
                              setShowOpenOrders(false)
                            }}
                          >
                            Lanjutkan Bayar
                          </Button>
                        ) : (
                          /* OPEN: show normal buttons */
                          <>
                            <Button size="sm" variant="outline" onClick={() => loadOrder(order)}>
                              Lanjutkan
                            </Button>
                            <Button size="sm" className="bg-green-700 hover:bg-green-800"
                              onClick={() => openPaymentForOrder(order)}>
                              Bayar
                            </Button>
                            {order.items.length >= 2 && (
                              <Button size="sm" variant="outline"
                                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                                onClick={() => {
                                  setSplitOrder({
                                    id: order.id,
                                    orderNumber: order.orderNumber,
                                    items: order.items.map((i) => ({
                                      menuItemId: i.menuItemId,
                                      name: i.menuItem.name,
                                      price: i.priceAtOrder,
                                      quantity: i.quantity,
                                    })),
                                  })
                                  setSplitOpen(true)
                                  setShowOpenOrders(false)
                                }}>
                                <Users className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                        {isRestricted ? (
                          <Button
                            size="sm" variant="ghost"
                            className="text-amber-500 hover:text-amber-700"
                            onClick={() => {
                              setModRequestOrder({
                                id: order.id,
                                orderNumber: order.orderNumber,
                                items: order.items.map((i) => ({
                                  menuItemId: i.menuItemId,
                                  name: i.menuItem.name,
                                  quantity: i.quantity,
                                })),
                              })
                              setModRequestOpen(true)
                            }}
                            title="Minta persetujuan Owner"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            size="sm" variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => cancelOrder(order.id)}
                          >
                            Batal
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Payment Dialog ===== */}
      {paymentOrder && (
        <PaymentDialog
          open={paymentOpen}
          onClose={() => { setPaymentOpen(false); setPaymentOrder(null); fetchMenu(); fetchOpenOrders() }}
          onComplete={() => {
            setPaymentOpen(false)
            setPaymentOrder(null)
            fetchMenu()
            fetchOpenOrders()
          }}
          orderId={paymentOrder.id}
          orderNumber={paymentOrder.orderNumber}
          orderType={paymentOrder.type}
          tableNumber={paymentOrder.tableNumber}
          items={paymentOrder.items}
        />
      )}

      {/* ===== Mod Request Dialog ===== */}
      {modRequestOrder && (
        <ModRequestDialog
          open={modRequestOpen}
          onClose={() => { setModRequestOpen(false); setModRequestOrder(null) }}
          orderId={modRequestOrder.id}
          orderNumber={modRequestOrder.orderNumber}
          userId={session.userId}
          items={modRequestOrder.items}
        />
      )}

      {/* ===== Split Bill Dialog ===== */}
      {splitOrder && (
        <SplitBillDialog
          open={splitOpen}
          onClose={() => { setSplitOpen(false); setSplitOrder(null) }}
          onComplete={() => {
            setSplitOpen(false)
            setSplitOrder(null)
            fetchMenu()
            fetchOpenOrders()
            clearCart()
          }}
          orderId={splitOrder.id}
          orderNumber={splitOrder.orderNumber}
          items={splitOrder.items}
          existingPayments={splitOrder.existingPayments}
        />
      )}
    </div>
  )
}
