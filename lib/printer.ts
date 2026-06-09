// lib/printer.ts
import { PRINTER_SERVICE, PRINTER_CHARACTERISTIC } from "@/lib/escpos"

const STORAGE_KEY = "pos_printer_name"

let cachedDevice: BluetoothDevice | null = null
let cachedChar:   BluetoothRemoteGATTCharacteristic | null = null
let printerName:  string | null = null

// Listener untuk update UI
type StatusListener = (connected: boolean, name: string | null) => void
const listeners = new Set<StatusListener>()

export function onPrinterStatus(fn: StatusListener) {
  listeners.add(fn)
  return () => listeners.delete(fn)   // return unsubscribe
}

function notifyListeners() {
  listeners.forEach((fn) => fn(cachedChar !== null, printerName))
}

function handleDisconnect() {
  cachedChar = null
  notifyListeners()
}

export function getPrinterName(): string | null {
  if (printerName) return printerName
  if (typeof window !== "undefined") return localStorage.getItem(STORAGE_KEY)
  return null
}

export function isConnected(): boolean {
  return cachedChar !== null
}

async function connectToDevice(
  device: BluetoothDevice
): Promise<BluetoothRemoteGATTCharacteristic | null> {
  try {
    const server  = await device.gatt!.connect()
    const service = await server.getPrimaryService(PRINTER_SERVICE)
    const char    = await service.getCharacteristic(PRINTER_CHARACTERISTIC)
    cachedChar    = char
    const name    = device.name || "Printer"
    printerName   = name
    localStorage.setItem(STORAGE_KEY, name)
    notifyListeners()
    return char
  } catch {
    cachedChar = null
    notifyListeners()
    return null
  }
}

// Dipanggil saat app load — silent, tidak tampilkan popup
// Bekerja di Android, mungkin tidak di Windows
export async function autoConnect(): Promise<boolean> {
  try {
    const savedName = localStorage.getItem(STORAGE_KEY)
    if (savedName) printerName = savedName

    const devices: BluetoothDevice[] = await (navigator.bluetooth as any).getDevices()
    if (devices.length === 0) return false

    const printer = (savedName ? devices.find((d) => d.name === savedName) : null) ?? devices[0]
    if (!printer) return false

    cachedDevice = printer
    printer.addEventListener("gattserverdisconnected", handleDisconnect)
    printerName = printer.name || savedName || "Printer"
    notifyListeners()   // update UI dengan nama printer meski belum connect

    await connectToDevice(printer)
    return cachedChar !== null
  } catch {
    return false
  }
}

// Dipanggil dari tombol "Hubungkan Printer" — WAJIB dari user gesture
// Bekerja di semua platform termasuk Windows
export async function manualConnect(): Promise<boolean> {
  try {
    // Jika sudah ada device (Android auto-connect berhasil set cachedDevice)
    // coba reconnect tanpa popup
    if (cachedDevice && !cachedChar) {
      const char = await connectToDevice(cachedDevice)
      if (char) return true
    }

    // Windows: harus popup pilih device
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PRINTER_SERVICE] }],
      // Uncomment jika filter tidak cocok:
      // acceptAllDevices: true,
      // optionalServices: [PRINTER_SERVICE],
    })

    // Jika sebelumnya ada device lain, disconnect dulu
    if (cachedDevice && cachedDevice !== device) {
      cachedDevice.gatt?.disconnect()
      cachedDevice.removeEventListener("gattserverdisconnected", handleDisconnect)
    }

    cachedDevice = device
    device.addEventListener("gattserverdisconnected", handleDisconnect)

    const char = await connectToDevice(device)
    return char !== null
  } catch (err: any) {
    // User cancel = bukan error
    if (err?.name === "NotFoundError" || err?.message?.includes("cancelled")) return false
    throw err
  }
}

async function sendInChunks(
  char: BluetoothRemoteGATTCharacteristic,
  bytes: Uint8Array,
  chunkSize = 512
) {
  for (let i = 0; i < bytes.length; i += chunkSize) {
    await char.writeValue(bytes.slice(i, i + chunkSize))
    await new Promise((r) => setTimeout(r, 50))
  }
}

export async function printBytes(data: Uint8Array): Promise<void> {
  let char = cachedChar

  // Kasus 1: Sudah connected
  if (char) {
    await sendInChunks(char, data)
    return
  }

  // Kasus 2: Device dikenal, reconnect (tanpa popup)
  if (cachedDevice) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      char = await connectToDevice(cachedDevice)
      if (char) break
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
    if (char) {
      await sendInChunks(char, data)
      return
    }
    throw new Error("Printer tidak dapat dijangkau. Pastikan printer menyala.")
  }

  // Kasus 3: Belum pernah connect di session ini
  throw new Error("Printer belum terhubung. Tekan tombol printer di navbar untuk menghubungkan.")
}

export function forgetPrinter() {
  cachedDevice?.gatt?.disconnect()
  cachedDevice = null
  cachedChar   = null
  printerName  = null
  localStorage.removeItem(STORAGE_KEY)
  notifyListeners()
}