// components/printer-status.tsx
"use client"

import { useState, useEffect } from "react"
import { Bluetooth, BluetoothOff, Loader2 } from "lucide-react"
import { autoConnect, manualConnect, forgetPrinter, onPrinterStatus, getPrinterName } from "@/lib/printer"

export default function PrinterStatus() {
  const [connected,    setConnected]    = useState(false)
  const [printerName,  setPrinterName]  = useState<string | null>(null)
  const [connecting,   setConnecting]   = useState(false)
  const [errorMsg,     setErrorMsg]     = useState("")

  useEffect(() => {
    // Set initial state dari localStorage
    const saved = getPrinterName()
    if (saved) setPrinterName(saved)

    // Subscribe ke perubahan status printer
    const unsubscribe = onPrinterStatus((isConnected, name) => {
      setConnected(isConnected)
      if (name) setPrinterName(name)
    })

    return unsubscribe
  }, [])

  const handleConnect = async () => {
    setConnecting(true)
    setErrorMsg("")
    try {
      const success = await manualConnect()
      if (!success) setErrorMsg("Gagal terhubung")
    } catch (err: any) {
      setErrorMsg(err?.message || "Gagal terhubung")
    }
    setConnecting(false)
  }

  const handleForget = (e: React.MouseEvent) => {
    e.stopPropagation()
    forgetPrinter()
    setPrinterName(null)
    setConnected(false)
  }

  if (connecting) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-500 px-2 py-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Menghubungkan...</span>
      </div>
    )
  }

  if (connected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium px-2 py-1 rounded-lg bg-blue-50">
        <Bluetooth className="h-3.5 w-3.5" />
        <span>{printerName || "Printer"}</span>
        <button
          onClick={handleForget}
          className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
          title="Putuskan printer"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={handleConnect}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors border border-dashed border-gray-300 hover:border-amber-400"
        title={printerName ? `Hubungkan ke ${printerName}` : "Hubungkan printer"}
      >
        <BluetoothOff className="h-3.5 w-3.5" />
        <span>{printerName ? `Hubungkan ${printerName}` : "Hubungkan Printer"}</span>
      </button>
      {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
    </div>
  )
}