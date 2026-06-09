/**
 * Format number to IDR currency
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Generate daily order number: ORD-YYYYMMDD-XXXXX (timestamp-based for uniqueness)
 */
export function generateOrderNumber(sequence: number): string {
  const now = new Date()
  const dateStr =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0")
  // Use sequence + random suffix to avoid collisions
  const suffix = sequence.toString().padStart(3, "0")
  const rand = Math.floor(Math.random() * 90 + 10).toString()
  return `ORD-${dateStr}-${suffix}${rand}`
}

/**
 * Check if stock is below minimum threshold (default 25%)
 */
export function isLowStock(
  currentStock: number,
  initialStock: number,
  threshold = 0.25
): boolean {
  return currentStock <= initialStock * threshold
}

/**
 * cn utility for classnames
 */
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
