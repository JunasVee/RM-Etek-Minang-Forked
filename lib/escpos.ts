import type { ReceiptData } from "@/components/receipt-template"

// Bluetooth GATT UUIDs for thermal printer
export const PRINTER_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb"
export const PRINTER_CHARACTERISTIC = "00002af1-0000-1000-8000-00805f9b34fb"

// ESC/POS commands
const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

const CMD = {
  INIT: [ESC, 0x40],
  CENTER: [ESC, 0x61, 1],
  LEFT: [ESC, 0x61, 0],
  RIGHT: [ESC, 0x61, 2],
  BOLD_ON: [ESC, 0x45, 1],
  BOLD_OFF: [ESC, 0x45, 0],
  DOUBLE_ON: [GS, 0x21, 0x11],
  DOUBLE_OFF: [GS, 0x21, 0x00],
  FONT_B: [ESC, 0x4d, 1],
  FONT_A: [ESC, 0x4d, 0],
  CUT: [GS, 0x56, 0x00],
  FEED3: [ESC, 0x64, 3],
}

const LINE_WIDTH = 32 // 58mm printer

function encode(text: string): number[] {
  const result: number[] = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    result.push(code > 127 ? 0x3f : code) // Replace non-ASCII with ?
  }
  return result
}

function padRow(left: string, right: string, width = LINE_WIDTH): string {
  const gap = width - left.length - right.length
  return left + (gap > 0 ? " ".repeat(gap) : " ") + right
}

function centerText(text: string, width = LINE_WIDTH): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2))
  return " ".repeat(pad) + text
}

function separator(char = "-", width = LINE_WIDTH): string {
  return char.repeat(width)
}

function fmtRp(n: number): string {
  return "Rp" + n.toLocaleString("id-ID")
}

function buildBytes(...parts: (number | number[])[]): Uint8Array {
  const flat: number[] = []
  for (const p of parts) {
    if (Array.isArray(p)) flat.push(...p)
    else flat.push(p)
  }
  return new Uint8Array(flat)
}

export function buildEscPosReceipt(data: ReceiptData): Uint8Array {
  const lines: (number | number[])[] = []

  const add = (...cmds: (number | number[])[]) => lines.push(...cmds)
  const text = (s: string) => add(encode(s), [LF])
  const nl = () => add([LF])

  add(CMD.INIT)

  // Header
  add(CMD.CENTER, CMD.BOLD_ON, CMD.DOUBLE_ON)
  text("RM. ETEK MINANG")
  add(CMD.DOUBLE_OFF, CMD.BOLD_OFF)
  add(CMD.FONT_B)
  text("Jl. Contoh Alamat No. 123")
  add(CMD.FONT_A)
  text(separator())

  // Order info
  add(CMD.LEFT)
  text(padRow("No:", data.orderNumber))
  text(padRow("Tanggal:", `${data.date} ${data.time}`))
  text(padRow("Tipe:", data.type === "DINE_IN" ? "Dine-In" : "Takeaway"))
  if (data.tableNumber) text(padRow("Meja:", String(data.tableNumber)))
  text(padRow("Kasir:", data.cashierName))
  text(separator())

  // Items
  for (const item of data.items) {
    const name = item.name.length > 20 ? item.name.substring(0, 20) : item.name
    text(padRow(`${name} x${item.quantity}`, fmtRp(item.subtotal)))
  }
  text(separator())

  // Total
  add(CMD.BOLD_ON)
  text(padRow("TOTAL", fmtRp(data.total)))
  add(CMD.BOLD_OFF)

  // Payment
  text(padRow("Metode:", data.paymentMethod === "CASH" ? "Tunai" : "QRIS"))
  if (data.paymentMethod === "CASH") {
    text(padRow("Dibayar:", fmtRp(data.cashReceived || 0)))
    add(CMD.BOLD_ON)
    text(padRow("Kembalian:", fmtRp(data.changeAmount || 0)))
    add(CMD.BOLD_OFF)
  }

  text(separator())
  add(CMD.CENTER)
  nl()
  text("Terima kasih!")
  text("atas kunjungan Anda")
  nl()
  add(CMD.FEED3, CMD.CUT)

  return buildBytes(...lines)
}

// ===== Split bill receipt builders =====

export type SplitPersonData = {
  label: string
  amount: number
  method: "CASH" | "QRIS"
  cashReceived?: number
  changeAmount?: number
  items: { name: string; qty: number; price: number }[]
}

export function buildEscPosSplitPersonReceipt(
  orderNumber: string,
  person: SplitPersonData,
  personIdx: number,
  totalPersons: number,
  total: number,
): Uint8Array {
  const lines: (number | number[])[] = []
  const add = (...cmds: (number | number[])[]) => lines.push(...cmds)
  const text = (s: string) => add(encode(s), [LF])
  const nl = () => add([LF])

  add(CMD.INIT, CMD.CENTER, CMD.BOLD_ON, CMD.DOUBLE_ON)
  text("RM. ETEK MINANG")
  add(CMD.DOUBLE_OFF, CMD.BOLD_OFF, CMD.FONT_B)
  text("Jl. Contoh Alamat No. 123")
  add(CMD.FONT_A)
  text(separator())

  add(CMD.LEFT)
  text(padRow("No:", orderNumber))
  const now = new Date()
  text(padRow("Tanggal:", now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })))
  text(padRow("Nama:", person.label))
  text(padRow("Tagihan:", `${personIdx + 1} dari ${totalPersons}`))
  text(separator())

  if (person.items.length > 0) {
    for (const it of person.items) {
      const name = it.name.length > 20 ? it.name.substring(0, 20) : it.name
      text(padRow(`${name} x${it.qty}`, fmtRp(it.price * it.qty)))
    }
  } else {
    add(CMD.CENTER)
    text(`Bagi rata dari ${fmtRp(total)}`)
    add(CMD.LEFT)
  }
  text(separator())

  add(CMD.BOLD_ON)
  text(padRow("TOTAL BAYAR", fmtRp(person.amount)))
  add(CMD.BOLD_OFF)
  text(padRow("Metode:", person.method === "CASH" ? "Tunai" : "QRIS"))

  if (person.method === "CASH" && person.cashReceived) {
    text(padRow("Dibayar:", fmtRp(person.cashReceived)))
    add(CMD.BOLD_ON)
    text(padRow("Kembalian:", fmtRp(person.changeAmount || 0)))
    add(CMD.BOLD_OFF)
  }

  text(separator())
  add(CMD.CENTER)
  nl()
  text("Terima kasih!")
  nl()
  add(CMD.FEED3, CMD.CUT)

  return buildBytes(...lines)
}

export function buildEscPosSplitCombinedReceipt(
  orderNumber: string,
  items: { name: string; quantity: number; price: number }[],
  persons: SplitPersonData[],
  total: number,
): Uint8Array {
  const lines: (number | number[])[] = []
  const add = (...cmds: (number | number[])[]) => lines.push(...cmds)
  const text = (s: string) => add(encode(s), [LF])
  const nl = () => add([LF])

  add(CMD.INIT, CMD.CENTER, CMD.BOLD_ON, CMD.DOUBLE_ON)
  text("RM. ETEK MINANG")
  add(CMD.DOUBLE_OFF, CMD.BOLD_OFF, CMD.FONT_B)
  text("Jl. Contoh Alamat No. 123")
  add(CMD.FONT_A)
  text(separator())

  add(CMD.LEFT)
  text(padRow("No:", orderNumber))
  const now = new Date()
  text(padRow("Tanggal:", now.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })))
  text(padRow("Tipe:", `SPLIT BILL (${persons.length} org)`))
  text(separator())

  for (const item of items) {
    const name = item.name.length > 20 ? item.name.substring(0, 20) : item.name
    text(padRow(`${name} x${item.quantity}`, fmtRp(item.price * item.quantity)))
  }
  text(separator())

  add(CMD.BOLD_ON)
  text(padRow("TOTAL", fmtRp(total)))
  add(CMD.BOLD_OFF)
  text(separator())

  add(CMD.CENTER, CMD.BOLD_ON)
  text("PEMBAGIAN TAGIHAN")
  add(CMD.BOLD_OFF, CMD.LEFT)
  nl()

  for (const p of persons) {
    const method = p.method === "CASH" ? "Tunai" : "QRIS"
    text(padRow(p.label, `${fmtRp(p.amount)} (${method})`))
  }

  text(separator())
  add(CMD.CENTER)
  nl()
  text("Terima kasih!")
  nl()
  add(CMD.FEED3, CMD.CUT)

  return buildBytes(...lines)
}
