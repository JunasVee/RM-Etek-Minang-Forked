"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatRupiah, cn } from "@/lib/utils"
import { Users, Check, ArrowLeft, Banknote, QrCode, Printer, Plus, Minus, ChevronRight, RefreshCw, AlertTriangle, Lock, Loader2 } from "lucide-react"
import { printBytes } from "@/lib/printer"
import { buildEscPosSplitPersonReceipt, buildEscPosSplitCombinedReceipt, type SplitPersonData } from "@/lib/escpos"

type SplitItem = { menuItemId: string; name: string; price: number; quantity: number }
type Props = { open: boolean; onClose: () => void; onComplete: () => void; orderId: string; orderNumber: string; items: SplitItem[] }

type PersonDetail = {
  label: string; amount: number
  itemDetails: { menuItemId: string; name: string; price: number; qty: number }[]
  paid: boolean; method?: "CASH" | "QRIS"
  cashReceived?: number; changeAmount?: number
}

type SplitPlanData = {
  type: "equal" | "item"; splitGroup: string; personCount: number
  assignments: Record<string, number>; personLabels: string[]
}

type ItemChange = { added: { name: string; menuItemId: string; count: number }[]; removed: { name: string; count: number }[] }

type Step = "loading" | "method" | "setup-equal" | "setup-item" | "pay" | "done" | "print-select"

export default function SplitBillDialog({ open, onClose, onComplete, orderId, orderNumber, items }: Props) {
  const [step, setStep] = useState<Step>("loading")
  const [splitType, setSplitType] = useState<"equal" | "item">("equal")
  const [personCount, setPersonCount] = useState(2)
  const [persons, setPersons] = useState<PersonDetail[]>([])
  const [payingIdx, setPayingIdx] = useState<number | null>(null)
  const [payMethod, setPayMethod] = useState<"CASH" | "QRIS">("CASH")
  const [cashReceived, setCashReceived] = useState("")
  const [processing, setProcessing] = useState(false)
  const [splitGroup, setSplitGroup] = useState(() => `split_${Date.now()}`)
  const [somePaid, setSomePaid] = useState(false)
  const [assignments, setAssignments] = useState<Record<string, number>>({})
  const [personLabels, setPersonLabels] = useState<string[]>([])
  const [lockedKeys, setLockedKeys] = useState<Set<string>>(new Set())
  const [itemChange, setItemChange] = useState<ItemChange | null>(null)
  const [printing, setPrinting] = useState(false)
  const [printMsg, setPrintMsg] = useState("")

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)

  const allUnits: { key: string; menuItemId: string; name: string; price: number }[] = []
  items.forEach((item) => {
    for (let u = 0; u < item.quantity; u++) {
      allUnits.push({ key: `${item.menuItemId}:${u}`, menuItemId: item.menuItemId, name: item.name, price: item.price })
    }
  })

  function detectChanges(savedAssignments: Record<string, number>): ItemChange | null {
    const currentMenuIds = new Map<string, { name: string; count: number }>()
    items.forEach((i) => currentMenuIds.set(i.menuItemId, { name: i.name, count: i.quantity }))
    const planMenuIds = new Map<string, number>()
    Object.keys(savedAssignments).forEach((key) => {
      const mid = key.split(":")[0]
      planMenuIds.set(mid, (planMenuIds.get(mid) || 0) + 1)
    })
    const added: ItemChange["added"] = []
    const removed: ItemChange["removed"] = []
    currentMenuIds.forEach(({ name, count }, mid) => {
      const planCount = planMenuIds.get(mid) || 0
      if (count > planCount) added.push({ name, menuItemId: mid, count: count - planCount })
    })
    planMenuIds.forEach((planCount, mid) => {
      const current = currentMenuIds.get(mid)
      if (!current) removed.push({ name: mid, count: planCount })
      else if (current.count < planCount) removed.push({ name: current.name, count: planCount - current.count })
    })
    return (added.length === 0 && removed.length === 0) ? null : { added, removed }
  }

  function computeLockedKeys(asgn: Record<string, number>, paidLabels: string[], labels: string[]): Set<string> {
    const locked = new Set<string>()
    const paidIndices = new Set<number>()
    labels.forEach((label, idx) => { if (paidLabels.includes(label)) paidIndices.add(idx) })
    Object.entries(asgn).forEach(([key, pi]) => { if (paidIndices.has(pi)) locked.add(key) })
    return locked
  }

  function cleanAssignments(asgn: Record<string, number>): Record<string, number> {
    const validKeys = new Set(allUnits.map((u) => u.key))
    const cleaned: Record<string, number> = {}
    Object.entries(asgn).forEach(([key, val]) => { if (validKeys.has(key)) cleaned[key] = val })
    return cleaned
  }

  const buildPersonsFromAssignments = useCallback((
    asgn: Record<string, number>, labels: string[], count: number, paidPersons: PersonDetail[]
  ): PersonDetail[] => {
    const result: PersonDetail[] = []
    for (let i = 0; i < count; i++) {
      const paidMatch = paidPersons.find((p) => p.label === (labels[i] || `Orang ${i + 1}`))
      if (paidMatch) { result.push(paidMatch); continue }
      const itemMap = new Map<string, { menuItemId: string; name: string; price: number; qty: number }>()
      let amount = 0
      Object.entries(asgn).forEach(([key, personIdx]) => {
        if (personIdx !== i) return
        const menuItemId = key.split(":")[0]
        const item = items.find((it) => it.menuItemId === menuItemId)
        if (!item) return
        const existing = itemMap.get(menuItemId)
        if (existing) existing.qty++
        else itemMap.set(menuItemId, { menuItemId, name: item.name, price: item.price, qty: 1 })
        amount += item.price
      })
      result.push({ label: labels[i] || `Orang ${i + 1}`, amount, itemDetails: Array.from(itemMap.values()), paid: false })
    }
    return result
  }, [items])

  const savePlan = useCallback(async (type: "equal" | "item", group: string, count: number, asgn: Record<string, number>, labels: string[]) => {
    await fetch(`/api/orders/${orderId}/split-plan`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, splitGroup: group, personCount: count, assignments: asgn, personLabels: labels }),
    })
  }, [orderId])

  const loadState = useCallback(async () => {
    setStep("loading"); setItemChange(null)
    try {
      const [planRes, payRes] = await Promise.all([
        fetch(`/api/orders/${orderId}/split-plan`),
        fetch(`/api/orders/${orderId}/split-pay`),
      ])
      const [planData, payData] = await Promise.all([planRes.json(), payRes.json()])
      const existingPayments: PersonDetail[] = payData.success && payData.data.payments.length > 0
        ? payData.data.payments.map((p: any) => ({
            label: p.label || "Orang", amount: p.amount, itemDetails: [], paid: true,
            method: p.method, cashReceived: p.cashReceived, changeAmount: p.changeAmount,
          })) : []
      const paidLabels = existingPayments.map((p) => p.label)
      if (existingPayments.length > 0) setSomePaid(true)

      if (planData.success && planData.data) {
        const plan: SplitPlanData = planData.data
        setSplitType(plan.type); setSplitGroup(plan.splitGroup)
        setPersonCount(plan.personCount); setPersonLabels(plan.personLabels || [])

        if (plan.type === "item") {
          const changes = detectChanges(plan.assignments)
          const cleaned = cleanAssignments(plan.assignments)
          const locked = computeLockedKeys(cleaned, paidLabels, plan.personLabels || [])
          setLockedKeys(locked); setAssignments(cleaned)

          if (changes && existingPayments.length > 0) {
            setItemChange(changes)
            await savePlan("item", plan.splitGroup, plan.personCount, cleaned, plan.personLabels || [])
            const rebuilt = buildPersonsFromAssignments(cleaned, plan.personLabels || [], plan.personCount, existingPayments)
            setPersons(rebuilt)
            setStep("setup-item")
          } else {
            const rebuilt = buildPersonsFromAssignments(cleaned, plan.personLabels || [], plan.personCount, existingPayments)
            setPersons(rebuilt)
            setStep(payData.success && payData.data.fullyPaid ? "done" : "pay")
          }
        } else {
          const pp = Math.floor(total / plan.personCount); const rem = total - pp * plan.personCount
          const equalPersons = Array.from({ length: plan.personCount }, (_, i) => {
            const label = (plan.personLabels || [])[i] || `Orang ${i + 1}`
            const paidMatch = existingPayments.find((p) => p.label === label)
            if (paidMatch) return paidMatch
            return { label, amount: pp + (i === plan.personCount - 1 ? rem : 0), itemDetails: [] as any[], paid: false }
          })
          setAssignments(plan.assignments || {}); setLockedKeys(new Set()); setPersons(equalPersons)
          setStep(payData.success && payData.data.fullyPaid ? "done" : "pay")
        }
      } else if (existingPayments.length > 0) {
        const remaining = payData.data.remaining
        if (remaining > 0) existingPayments.push({ label: `Orang ${existingPayments.length + 1}`, amount: remaining, itemDetails: [], paid: false })
        setPersons(existingPayments)
        setStep(payData.data.fullyPaid ? "done" : "pay")
      } else { setStep("method") }
    } catch { setStep("method") }
  }, [orderId, total, buildPersonsFromAssignments, savePlan])

  useEffect(() => { if (open) loadState() }, [open, loadState])

  const reset = () => {
    setStep("loading"); setPersons([]); setPayingIdx(null); setCashReceived("")
    setAssignments({}); setPersonLabels([]); setPayMethod("CASH")
    setSomePaid(false); setLockedKeys(new Set()); setItemChange(null)
    setPrinting(false); setPrintMsg("")
  }
  const handleClose = () => { if (somePaid) { reset(); onComplete() } else { reset(); onClose() } }

  const paidCount = persons.filter((p) => p.paid).length
  const paidTotal = persons.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0)
  const remainingAmount = total - paidTotal
  const allPaid = persons.length > 0 && persons.every((p) => p.paid)
  const allAssigned = Object.keys(assignments).length === allUnits.length

  const setupEqual = async () => {
    const labels = Array.from({ length: personCount }, (_, i) => `Orang ${i + 1}`)
    const pp = Math.floor(total / personCount); const rem = total - pp * personCount
    setPersonLabels(labels); setSplitType("equal")
    setPersons(labels.map((label, i) => ({ label, amount: pp + (i === personCount - 1 ? rem : 0), itemDetails: [], paid: false })))
    await savePlan("equal", splitGroup, personCount, {}, labels)
    setStep("pay")
  }

  const setupItemSplit = async () => {
    const labels = Array.from({ length: personCount }, (_, i) => personLabels[i] || `Orang ${i + 1}`)
    const paidPersons = persons.filter((p) => p.paid)
    const rebuilt = buildPersonsFromAssignments(assignments, labels, personCount, paidPersons)
    setPersons(rebuilt); setPersonLabels(labels); setSplitType("item")
    await savePlan("item", splitGroup, personCount, assignments, labels)
    setItemChange(null); setStep("pay")
  }

  const reassignItem = (unitKey: string, newPersonIdx: number) => {
    if (lockedKeys.has(unitKey)) return
    const newAsgn = { ...assignments }
    if (newPersonIdx === -1) delete newAsgn[unitKey]
    else newAsgn[unitKey] = newPersonIdx
    setAssignments(newAsgn)
  }

  const handlePayPerson = async (idx: number) => {
    const person = persons[idx]; setProcessing(true)
    const body: any = { splitGroup, splitLabel: person.label, totalAmount: person.amount, paymentMethod: payMethod }
    if (payMethod === "CASH") { const c = parseInt(cashReceived) || 0; if (c < person.amount) { setProcessing(false); return }; body.cashReceived = c }
    const res = await fetch(`/api/orders/${orderId}/split-pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json()
    if (data.success) {
      const ca = parseInt(cashReceived) || 0; const updated = [...persons]
      updated[idx] = { ...updated[idx], paid: true, method: payMethod, cashReceived: payMethod === "CASH" ? ca : undefined, changeAmount: payMethod === "CASH" ? ca - person.amount : undefined }
      setPersons(updated); setPayingIdx(null); setCashReceived(""); setSomePaid(true)
      const newLocked = new Set(lockedKeys)
      Object.entries(assignments).forEach(([key, pi]) => { if (pi === idx) newLocked.add(key) })
      setLockedKeys(newLocked)
      if (data.data.fullyPaid) setStep("done")
    }
    setProcessing(false)
  }

  const updateLabel = (idx: number, val: string) => {
    const up = [...persons]; up[idx] = { ...up[idx], label: val }; setPersons(up)
    const l = [...personLabels]; l[idx] = val; setPersonLabels(l)
  }

  // ===== Direct Bluetooth printing =====
  function toSplitPerson(p: PersonDetail): SplitPersonData {
    return {
      label: p.label, amount: p.amount,
      method: (p.method || "CASH") as "CASH" | "QRIS",
      cashReceived: p.cashReceived, changeAmount: p.changeAmount,
      items: p.itemDetails.map((it) => ({ name: it.name, qty: it.qty, price: it.price })),
    }
  }

  async function doPrint(buildFn: () => Uint8Array, label: string) {
    setPrinting(true); setPrintMsg(`Mencetak ${label}...`)
    try {
      await printBytes(buildFn())
      setPrintMsg(`✓ ${label} tercetak`)
      setTimeout(() => setPrintMsg(""), 2000)
    } catch (err: any) {
      setPrintMsg(`✗ Gagal: ${err?.message || "error"}`)
      setTimeout(() => setPrintMsg(""), 4000)
    }
    setPrinting(false)
  }

  function printPerson(idx: number) {
    const p = persons[idx]
    const totalPaid = persons.filter((x) => x.paid).length || persons.length
    doPrint(
      () => buildEscPosSplitPersonReceipt(orderNumber, toSplitPerson(p), idx, totalPaid, total),
      `struk ${p.label}`
    )
  }

  function printCombined() {
    const paidPersons = persons.filter((p) => p.paid).map(toSplitPerson)
    doPrint(
      () => buildEscPosSplitCombinedReceipt(orderNumber, items, paidPersons, total),
      "struk gabungan"
    )
  }

  async function printAllSequential() {
    setPrinting(true)
    const paid = persons.filter((p) => p.paid)
    const totalPaid = paid.length
    for (let i = 0; i < paid.length; i++) {
      const p = paid[i]
      setPrintMsg(`Mencetak ${i + 1}/${totalPaid}: ${p.label}...`)
      try {
        await printBytes(buildEscPosSplitPersonReceipt(orderNumber, toSplitPerson(p), i, totalPaid, total))
        // Small delay between prints
        if (i < paid.length - 1) await new Promise((r) => setTimeout(r, 800))
      } catch (err: any) {
        setPrintMsg(`✗ Gagal di ${p.label}: ${err?.message || "error"}`)
        setPrinting(false)
        setTimeout(() => setPrintMsg(""), 4000)
        return
      }
    }
    setPrintMsg(`✓ ${totalPaid} struk tercetak`)
    setPrinting(false)
    setTimeout(() => setPrintMsg(""), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-amber-700" />Bagi Tagihan — {orderNumber}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto py-2 space-y-4">

          {/* Print status bar */}
          {printMsg && (
            <div className={cn("rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2",
              printMsg.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" :
              printMsg.startsWith("✗") ? "bg-red-50 text-red-700 border border-red-200" :
              "bg-blue-50 text-blue-700 border border-blue-200")}>
              {printing && <Loader2 className="h-4 w-4 animate-spin" />}
              {printMsg}
            </div>
          )}

          {step === "loading" && <div className="text-center py-12"><div className="text-3xl mb-3 animate-pulse">⏳</div><p className="text-sm text-muted-foreground">Memuat data...</p></div>}

          {step === "method" && (<div className="space-y-4">
            <div className="bg-amber-50 rounded-xl p-4 text-center"><p className="text-sm text-amber-700">Total Tagihan</p><p className="text-2xl font-bold text-amber-900">{formatRupiah(total)}</p></div>
            <button onClick={() => { setSplitType("equal"); setStep("setup-equal") }} className="w-full p-4 border-2 rounded-xl text-left hover:border-amber-400"><p className="font-bold">Bagi Rata</p><p className="text-sm text-muted-foreground">Total dibagi rata untuk semua orang</p></button>
            <button onClick={() => { setSplitType("item"); setStep("setup-item") }} className="w-full p-4 border-2 rounded-xl text-left hover:border-amber-400"><p className="font-bold">Per Item</p><p className="text-sm text-muted-foreground">Setiap orang bayar item masing-masing</p></button>
          </div>)}

          {step === "setup-equal" && (<div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("method")}><ArrowLeft className="h-4 w-4 mr-1" /> Kembali</Button>
            <label className="text-sm font-medium">Berapa orang?</label>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setPersonCount(Math.max(2, personCount - 1))} className="h-12 w-12 rounded-xl border-2 border-gray-200 flex items-center justify-center font-bold active:bg-gray-100 hover:border-amber-400"><Minus className="h-5 w-5" /></button>
              <span className="text-4xl font-black text-amber-900 w-16 text-center">{personCount}</span>
              <button onClick={() => setPersonCount(Math.min(20, personCount + 1))} className="h-12 w-12 rounded-xl border-2 border-gray-200 flex items-center justify-center font-bold active:bg-gray-100 hover:border-amber-400"><Plus className="h-5 w-5" /></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center"><p className="text-sm text-muted-foreground">Per orang:</p><p className="text-xl font-bold">{formatRupiah(Math.ceil(total / personCount))}</p></div>
            <Button onClick={setupEqual} className="w-full bg-amber-800 hover:bg-amber-900">Lanjutkan ke Pembayaran</Button>
          </div>)}

          {step === "setup-item" && (<div className="space-y-4">
            {!itemChange && <Button variant="ghost" size="sm" onClick={() => paidCount > 0 ? setStep("pay") : setStep("method")}><ArrowLeft className="h-4 w-4 mr-1" /> Kembali</Button>}

            {itemChange && (
              <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-2 text-orange-800 font-bold text-sm"><AlertTriangle className="h-4 w-4" /> Pesanan Berubah!</div>
                {itemChange.added.length > 0 && <p className="text-xs text-orange-700">Ditambah: {itemChange.added.map((a) => `${a.name} (×${a.count})`).join(", ")}</p>}
                {itemChange.removed.length > 0 && <p className="text-xs text-orange-700">Dihapus: {itemChange.removed.map((r) => `${r.name} (×${r.count})`).join(", ")}</p>}
                <p className="text-xs text-orange-600">Atur ulang item baru. Item yang sudah dibayar tidak bisa diubah.</p>
              </div>
            )}

            <label className="text-sm font-medium">Berapa orang?</label>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setPersonCount(Math.max(2, personCount - 1))} className="h-10 w-10 rounded-xl border-2 border-gray-200 flex items-center justify-center font-bold active:bg-gray-100 hover:border-amber-400"><Minus className="h-4 w-4" /></button>
              <span className="text-3xl font-black text-amber-900 w-12 text-center">{personCount}</span>
              <button onClick={() => setPersonCount(Math.min(20, personCount + 1))} className="h-10 w-10 rounded-xl border-2 border-gray-200 flex items-center justify-center font-bold active:bg-gray-100 hover:border-amber-400"><Plus className="h-4 w-4" /></button>
            </div>

            <p className="text-sm font-medium">Pilih pemilik setiap item:</p>
            <div className="space-y-1.5">
              {allUnits.map((unit) => {
                const assignedTo = assignments[unit.key]
                const isLocked = lockedKeys.has(unit.key)
                return (
                  <div key={unit.key} className={cn("flex items-center justify-between p-2.5 border rounded-lg text-sm",
                    isLocked ? "border-green-300 bg-green-50/50" : assignedTo !== undefined ? "border-amber-300 bg-amber-50" : "border-red-200 bg-red-50/30")}>
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      {isLocked && <Lock className="h-3 w-3 text-green-600 shrink-0" />}
                      <span className={cn("font-medium", isLocked && "text-green-800")}>{unit.name}</span>
                      <span className="text-muted-foreground">({formatRupiah(unit.price)})</span>
                    </div>
                    {isLocked ? (
                      <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 shrink-0">
                        {personLabels[assignedTo] || `Orang ${assignedTo + 1}`} ✓
                      </Badge>
                    ) : (
                      <select value={assignedTo !== undefined ? assignedTo.toString() : ""}
                        onChange={(e) => reassignItem(unit.key, e.target.value === "" ? -1 : parseInt(e.target.value))}
                        className="border rounded-lg px-2 py-1.5 text-xs ml-2 shrink-0">
                        <option value="">—</option>
                        {Array.from({ length: personCount }, (_, i) => {
                          const isPaidPerson = persons[i]?.paid === true
                          return <option key={i} value={i} disabled={isPaidPerson}>{personLabels[i] || `Orang ${i + 1}`}{isPaidPerson ? " ✓ Lunas" : ""}</option>
                        })}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>

            {Object.keys(assignments).length > 0 && (
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">Ringkasan:</p>
                {Array.from({ length: personCount }, (_, i) => {
                  const amt = allUnits.filter((u) => assignments[u.key] === i).reduce((s, u) => s + u.price, 0)
                  const isPaid = persons[i]?.paid
                  return <div key={i} className="flex justify-between text-sm"><span className={cn(isPaid && "text-green-700")}>{personLabels[i] || `Orang ${i + 1}`} {isPaid && "✓"}</span><span className="font-mono font-bold">{formatRupiah(amt)}</span></div>
                })}
              </div>
            )}

            {!allAssigned && <p className="text-xs text-red-500">Semua item harus ditentukan pemiliknya</p>}
            <Button onClick={setupItemSplit} disabled={!allAssigned} className="w-full bg-amber-800 hover:bg-amber-900">
              {itemChange ? "Simpan & Lanjutkan" : "Lanjutkan ke Pembayaran"}
            </Button>
          </div>)}

          {step === "pay" && (<div className="space-y-3">
            <div className="bg-amber-50 rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-amber-700">Total tagihan</span><span className="font-bold text-amber-900">{formatRupiah(total)}</span></div>
              {paidCount > 0 && (<><div className="flex justify-between text-sm"><span className="text-green-700">Sudah dibayar ({paidCount})</span><span className="font-bold text-green-800">{formatRupiah(paidTotal)}</span></div>
              <div className="flex justify-between text-sm border-t border-amber-200 pt-1"><span className="text-red-700 font-medium">Sisa</span><span className="font-bold text-red-800">{formatRupiah(remainingAmount)}</span></div></>)}
            </div>
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Pembayaran</span><Badge variant={allPaid ? "default" : "secondary"}>{paidCount}/{persons.length} lunas</Badge></div>

            {splitType === "item" && !allPaid && (
              <button onClick={() => setStep("setup-item")} className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 font-medium">
                <RefreshCw className="h-3 w-3" /> Ubah pembagian item
              </button>
            )}

            {persons.map((person, idx) => (
              <div key={idx} className={cn("border-2 rounded-xl p-3 transition-all", person.paid ? "border-green-300 bg-green-50" : "border-gray-200")}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {!person.paid ? (
                      <input value={person.label} onChange={(e) => updateLabel(idx, e.target.value)}
                        className="font-bold text-sm bg-transparent border-b border-dashed border-gray-300 focus:border-amber-500 outline-none w-full max-w-[140px]" placeholder="Nama..." />
                    ) : <p className="font-bold text-sm">{person.label}</p>}
                    <p className="text-lg font-bold">{formatRupiah(person.amount)}</p>
                    {person.itemDetails.length > 0 && <p className="text-xs text-muted-foreground">{person.itemDetails.map((it) => `${it.name}×${it.qty}`).join(", ")}</p>}
                  </div>
                  {person.paid ? (
                    <div className="text-right shrink-0"><Badge className="bg-green-600 text-white"><Check className="h-3 w-3 mr-1" />Lunas</Badge><p className="text-xs text-green-600 mt-1">{person.method === "CASH" ? "Tunai" : "QRIS"}</p></div>
                  ) : person.amount > 0 ? (
                    <Button size="sm" onClick={() => { setPayingIdx(idx); setCashReceived(""); setPayMethod("CASH") }} className="bg-amber-800 hover:bg-amber-900 shrink-0">Bayar</Button>
                  ) : <Badge variant="secondary" className="text-xs shrink-0">Tidak ada item</Badge>}
                </div>
                {payingIdx === idx && !person.paid && (<div className="mt-3 pt-3 border-t space-y-3">
                  <div className="flex gap-2">
                    <button onClick={() => setPayMethod("CASH")} className={cn("flex-1 py-2 rounded-lg border-2 text-sm font-medium", payMethod === "CASH" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200")}><Banknote className="h-4 w-4 inline mr-1" />Tunai</button>
                    <button onClick={() => setPayMethod("QRIS")} className={cn("flex-1 py-2 rounded-lg border-2 text-sm font-medium", payMethod === "QRIS" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200")}><QrCode className="h-4 w-4 inline mr-1" />QRIS</button>
                  </div>
                  {payMethod === "CASH" && <div className="space-y-2"><input type="number" inputMode="numeric" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="Uang diterima..." className="w-full px-3 py-2.5 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />{parseInt(cashReceived) >= person.amount && <p className="text-sm text-green-600 font-medium">Kembalian: {formatRupiah(parseInt(cashReceived) - person.amount)}</p>}</div>}
                  <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPayingIdx(null)}>Batal</Button>
                    <Button size="sm" onClick={() => handlePayPerson(idx)} disabled={processing || (payMethod === "CASH" && (parseInt(cashReceived) || 0) < person.amount)} className="bg-green-700 hover:bg-green-800 flex-1">{processing ? "Memproses..." : "Konfirmasi Bayar"}</Button></div>
                </div>)}
                {person.paid && <button onClick={() => !printing && printPerson(idx)} className={cn("flex items-center gap-1 mt-2 text-xs text-amber-700 hover:text-amber-900", printing && "opacity-50")}><Printer className="h-3 w-3" /> Cetak struk {person.label}</button>}
              </div>
            ))}

            {paidCount > 0 && !allPaid && (<div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-sm text-blue-800 font-medium mb-2">{paidCount} dari {persons.length} sudah bayar. Sisanya bisa bayar nanti.</p>
              <Button variant="outline" size="sm" onClick={() => handleClose()}>Tutup & Lanjutkan Nanti</Button>
            </div>)}
          </div>)}

          {step === "done" && (<div className="text-center py-4">
            <div className="text-5xl mb-4"></div><h2 className="text-lg font-bold text-green-800 mb-2">Semua Tagihan Lunas!</h2>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-sm mb-4">
              {persons.filter(p => p.paid).map((p, i) => (<div key={i} className="flex justify-between"><span>{p.label}</span><span className="font-mono">{formatRupiah(p.amount)} ({p.method === "CASH" ? "Tunai" : "QRIS"})</span></div>))}
              <div className="border-t pt-1 mt-1 flex justify-between font-bold"><span>Total</span><span className="font-mono">{formatRupiah(total)}</span></div>
            </div>
            <div className="space-y-2 mb-4"><p className="text-sm font-medium text-muted-foreground">Cetak Struk</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={printCombined} disabled={printing}>
                  <Printer className="h-4 w-4 mr-2" /> Gabungan
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setStep("print-select")} disabled={printing}>
                  <Printer className="h-4 w-4 mr-2" /> Per Orang
                </Button>
              </div></div>
            <Button onClick={() => { reset(); onComplete() }} className="w-full bg-amber-800 hover:bg-amber-900">Selesai</Button>
          </div>)}

          {step === "print-select" && (<div className="space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setStep("done")}><ArrowLeft className="h-4 w-4 mr-1" /> Kembali</Button>
            <p className="text-sm font-medium">Pilih struk yang ingin dicetak:</p>
            {persons.filter(p => p.paid).map((p, i) => { const ri = persons.indexOf(p); return (
              <button key={i} onClick={() => !printing && printPerson(ri)} className={cn("w-full flex items-center justify-between p-3 border-2 rounded-xl hover:border-amber-400", printing && "opacity-50")}>
                <div className="text-left"><p className="font-bold text-sm">{p.label}</p>{p.itemDetails.length > 0 && <p className="text-xs text-muted-foreground">{p.itemDetails.map(it => it.name).join(", ")}</p>}</div>
                <div className="flex items-center gap-2"><p className="font-bold">{formatRupiah(p.amount)}</p><ChevronRight className="h-4 w-4 text-gray-400" /></div>
              </button>)})}
            <Button variant="outline" className="w-full" onClick={printAllSequential} disabled={printing}>
              <Printer className="h-4 w-4 mr-2" /> Cetak Semua Struk
            </Button>
          </div>)}

        </div>
      </DialogContent>
    </Dialog>
  )
}
