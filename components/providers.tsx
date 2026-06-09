"use client"

import { useEffect } from "react"
import ErrorBoundary from "@/components/error-boundary"
import OfflineBanner from "@/components/offline-banner"
import { autoConnect } from "@/lib/printer"

export default function Providers({ children }: { children: React.ReactNode }) {
  // Auto-reconnect to previously paired thermal printer on app load
  useEffect(() => {
    autoConnect()
  }, [])

  return (
    <ErrorBoundary>
      <OfflineBanner />
      {children}
    </ErrorBoundary>
  )
}
