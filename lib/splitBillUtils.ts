
/**
 * Hitung kembalian dari pembayaran tunai
 * @param cashReceived - Jumlah uang yang diterima
 * @param totalAmount - Total tagihan yang harus dibayar
 * @returns Nominal kembalian, atau null jika bukan pembayaran tunai
 */
export function calculateChange(
  cashReceived: number | null,
  totalAmount: number
): number | null {
  if (cashReceived === null || cashReceived === undefined) return null;
  if (cashReceived < totalAmount) return null;
  return cashReceived - totalAmount;
}

/**
 * Cek apakah semua tagihan sudah lunas berdasarkan akumulasi pembayaran
 * @param paidTotal - Total yang sudah dibayar
 * @param orderTotal - Total pesanan
 * @returns true jika sudah lunas, false jika belum
 */
export function isFullyPaid(paidTotal: number, orderTotal: number): boolean {
  return paidTotal >= orderTotal;
}

/**
 * Tentukan status pesanan berdasarkan jumlah yang sudah dibayar
 * @param paidTotal - Total yang sudah dibayar
 * @param orderTotal - Total pesanan
 * @returns "PAID" jika lunas, "PARTIALLY_PAID" jika sebagian
 */
export function determineOrderStatus(
  paidTotal: number,
  orderTotal: number
): "PAID" | "PARTIALLY_PAID" {
  return isFullyPaid(paidTotal, orderTotal) ? "PAID" : "PARTIALLY_PAID";
}

/**
 * Hitung pembagian rata untuk N orang
 * Sisa pembagian dibebankan ke orang terakhir agar total tepat sama
 * @param total - Total tagihan
 * @param personCount - Jumlah orang
 * @returns Array berisi nominal per orang
 */
export function calculateEqualSplit(
  total: number,
  personCount: number
): number[] {
  if (personCount <= 0) throw new Error("Jumlah orang harus lebih dari 0");
  if (total < 0) throw new Error("Total tidak boleh negatif");

  const perPerson = Math.floor(total / personCount);
  const remainder = total - perPerson * personCount;

  return Array.from({ length: personCount }, (_, i) =>
    i === personCount - 1 ? perPerson + remainder : perPerson
  );
}

/**
 * Hitung sisa tagihan yang belum dibayar
 * @param orderTotal - Total pesanan
 * @param paidTotal - Total yang sudah dibayar
 * @returns Sisa yang belum dibayar (minimum 0)
 */
export function calculateRemaining(
  orderTotal: number,
  paidTotal: number
): number {
  return Math.max(0, orderTotal - paidTotal);
}