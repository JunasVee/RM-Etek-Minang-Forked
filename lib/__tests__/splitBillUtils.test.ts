import {
  calculateChange,
  isFullyPaid,
  determineOrderStatus,
  calculateEqualSplit,
  calculateRemaining,
} from "../splitBillUtils";

// ─── calculateChange ─────────────────────────────────────────
describe("calculateChange", () => {
  it("menghitung kembalian dengan benar saat uang lebih dari tagihan", () => {
    expect(calculateChange(100000, 75000)).toBe(25000);
  });

  it("mengembalikan 0 saat uang pas dengan tagihan", () => {
    expect(calculateChange(50000, 50000)).toBe(0);
  });

  it("mengembalikan null saat uang kurang dari tagihan", () => {
    expect(calculateChange(40000, 50000)).toBeNull();
  });

  it("mengembalikan null saat cashReceived adalah null", () => {
    expect(calculateChange(null, 50000)).toBeNull();
  });
});

// ─── isFullyPaid ─────────────────────────────────────────────
describe("isFullyPaid", () => {
  it("mengembalikan true saat paidTotal sama dengan orderTotal", () => {
    expect(isFullyPaid(150000, 150000)).toBe(true);
  });

  it("mengembalikan true saat paidTotal melebihi orderTotal", () => {
    expect(isFullyPaid(160000, 150000)).toBe(true);
  });

  it("mengembalikan false saat paidTotal kurang dari orderTotal", () => {
    expect(isFullyPaid(100000, 150000)).toBe(false);
  });
});

// ─── determineOrderStatus ────────────────────────────────────
describe("determineOrderStatus", () => {
  it("mengembalikan PAID saat tagihan sudah lunas", () => {
    expect(determineOrderStatus(200000, 200000)).toBe("PAID");
  });

  it("mengembalikan PARTIALLY_PAID saat baru sebagian terbayar", () => {
    expect(determineOrderStatus(100000, 200000)).toBe("PARTIALLY_PAID");
  });

  it("mengembalikan PARTIALLY_PAID saat belum ada pembayaran", () => {
    expect(determineOrderStatus(0, 200000)).toBe("PARTIALLY_PAID");
  });
});

// ─── calculateEqualSplit ─────────────────────────────────────
describe("calculateEqualSplit", () => {
  it("membagi tagihan rata untuk 4 orang tanpa sisa", () => {
    const result = calculateEqualSplit(200000, 4);
    expect(result).toEqual([50000, 50000, 50000, 50000]);
  });

  it("memberikan sisa pembagian ke orang terakhir", () => {
    // 100000 / 3 = 33333 sisa 1
    const result = calculateEqualSplit(100000, 3);
    expect(result).toEqual([33333, 33333, 33334]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100000);
  });

  it("melempar error saat jumlah orang nol atau negatif", () => {
    expect(() => calculateEqualSplit(100000, 0)).toThrow(
      "Jumlah orang harus lebih dari 0"
    );
  });

  it("melempar error saat total negatif", () => {
    expect(() => calculateEqualSplit(-50000, 2)).toThrow(
      "Total tidak boleh negatif"
    );
  });

  it("memastikan total pembagian selalu sama dengan total awal", () => {
    const result = calculateEqualSplit(99999, 7);
    expect(result.reduce((a, b) => a + b, 0)).toBe(99999);
  });
});

// ─── calculateRemaining ──────────────────────────────────────
describe("calculateRemaining", () => {
  it("menghitung sisa tagihan dengan benar", () => {
    expect(calculateRemaining(200000, 75000)).toBe(125000);
  });

  it("mengembalikan 0 saat sudah lunas", () => {
    expect(calculateRemaining(150000, 150000)).toBe(0);
  });

  it("mengembalikan 0 saat overpaid (tidak negatif)", () => {
    expect(calculateRemaining(100000, 120000)).toBe(0);
  });
});