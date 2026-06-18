import {
  buildEscPosReceipt,
  buildEscPosSplitPersonReceipt,
  buildEscPosSplitCombinedReceipt,
  PRINTER_SERVICE,
  PRINTER_CHARACTERISTIC,
  type SplitPersonData,
} from "../escpos";
import type { ReceiptData } from "@/components/receipt-template";

function bytesToText(bytes: Uint8Array): string {
  return Array.from(bytes)
    .filter((b) => b >= 0x20 && b <= 0x7e)
    .map((b) => String.fromCharCode(b))
    .join("");
}

const sampleReceipt: ReceiptData = {
  orderNumber: "ORD-20250618-00101",
  date: "18 Jun 2025",
  time: "14:30",
  type: "DINE_IN",
  tableNumber: 5,
  cashierName: "Budi",
  items: [
    { name: "Rendang", quantity: 2, price: 35000, subtotal: 70000 },
    { name: "Es Teh Manis", quantity: 2, price: 5000, subtotal: 10000 },
  ],
  total: 80000,
  paymentMethod: "CASH",
  cashReceived: 100000,
  changeAmount: 20000,
};

describe("constants", () => {
  it("PRINTER_SERVICE adalah UUID valid", () => {
    expect(PRINTER_SERVICE).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("PRINTER_CHARACTERISTIC adalah UUID valid", () => {
    expect(PRINTER_CHARACTERISTIC).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

describe("buildEscPosReceipt", () => {
  it("mengembalikan Uint8Array", () => {
    const result = buildEscPosReceipt(sampleReceipt);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("mengandung nama restoran", () => {
    const result = buildEscPosReceipt(sampleReceipt);
    const text = bytesToText(result);
    expect(text).toContain("RM. ETEK MINANG");
  });

  it("mengandung nomor order", () => {
    const result = buildEscPosReceipt(sampleReceipt);
    const text = bytesToText(result);
    expect(text).toContain("ORD-20250618-00101");
  });

  it("mengandung nama item", () => {
    const result = buildEscPosReceipt(sampleReceipt);
    const text = bytesToText(result);
    expect(text).toContain("Rendang");
    expect(text).toContain("Es Teh Manis");
  });

  it("mengandung total dalam format Rupiah", () => {
    const result = buildEscPosReceipt(sampleReceipt);
    const text = bytesToText(result);
    expect(text).toContain("TOTAL");
    expect(text).toContain("Rp80");
  });

  it("mengandung info pembayaran tunai", () => {
    const result = buildEscPosReceipt(sampleReceipt);
    const text = bytesToText(result);
    expect(text).toContain("Tunai");
    expect(text).toContain("Rp100");
  });

  it("menampilkan Dine-In untuk tipe DINE_IN", () => {
    const result = buildEscPosReceipt(sampleReceipt);
    const text = bytesToText(result);
    expect(text).toContain("Dine-In");
  });

  it("menampilkan Takeaway untuk tipe TAKEAWAY", () => {
    const takeaway: ReceiptData = { ...sampleReceipt, type: "TAKEAWAY", tableNumber: null };
    const result = buildEscPosReceipt(takeaway);
    const text = bytesToText(result);
    expect(text).toContain("Takeaway");
  });

  it("menampilkan nomor meja jika ada", () => {
    const result = buildEscPosReceipt(sampleReceipt);
    const text = bytesToText(result);
    expect(text).toContain("Meja:");
  });

  it("tidak menampilkan meja jika null", () => {
    const noTable: ReceiptData = { ...sampleReceipt, tableNumber: null };
    const result = buildEscPosReceipt(noTable);
    const text = bytesToText(result);
    expect(text).not.toContain("Meja:");
  });

  it("menampilkan QRIS tanpa kembalian", () => {
    const qris: ReceiptData = {
      ...sampleReceipt,
      paymentMethod: "QRIS",
      cashReceived: null,
      changeAmount: null,
    };
    const result = buildEscPosReceipt(qris);
    const text = bytesToText(result);
    expect(text).toContain("QRIS");
    expect(text).not.toContain("Kembalian");
  });

  it("mengandung pesan terima kasih", () => {
    const result = buildEscPosReceipt(sampleReceipt);
    const text = bytesToText(result);
    expect(text).toContain("Terima kasih!");
  });

  it("diawali ESC/POS init command (0x1B 0x40)", () => {
    const result = buildEscPosReceipt(sampleReceipt);
    expect(result[0]).toBe(0x1b);
    expect(result[1]).toBe(0x40);
  });

  it("truncate nama item panjang ke 20 karakter", () => {
    const longItem: ReceiptData = {
      ...sampleReceipt,
      items: [
        { name: "Nasi Goreng Spesial Kambing Bakar", quantity: 1, price: 50000, subtotal: 50000 },
      ],
      total: 50000,
    };
    const result = buildEscPosReceipt(longItem);
    const text = bytesToText(result);
    expect(text).not.toContain("Nasi Goreng Spesial Kambing Bakar");
    expect(text).toContain("Nasi Goreng Spesial ");
  });
});

describe("buildEscPosSplitPersonReceipt", () => {
  const person: SplitPersonData = {
    label: "Andi",
    amount: 40000,
    method: "CASH",
    cashReceived: 50000,
    changeAmount: 10000,
    items: [{ name: "Rendang", qty: 1, price: 40000 }],
  };

  it("mengembalikan Uint8Array", () => {
    const result = buildEscPosSplitPersonReceipt("ORD-001", person, 0, 2, 80000);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it("mengandung nama restoran", () => {
    const result = buildEscPosSplitPersonReceipt("ORD-001", person, 0, 2, 80000);
    const text = bytesToText(result);
    expect(text).toContain("RM. ETEK MINANG");
  });

  it("mengandung nama orang", () => {
    const result = buildEscPosSplitPersonReceipt("ORD-001", person, 0, 2, 80000);
    const text = bytesToText(result);
    expect(text).toContain("Andi");
  });

  it("mengandung info tagihan X dari Y", () => {
    const result = buildEscPosSplitPersonReceipt("ORD-001", person, 0, 2, 80000);
    const text = bytesToText(result);
    expect(text).toContain("1 dari 2");
  });

  it("menampilkan item jika ada", () => {
    const result = buildEscPosSplitPersonReceipt("ORD-001", person, 0, 2, 80000);
    const text = bytesToText(result);
    expect(text).toContain("Rendang");
  });

  it("menampilkan 'Bagi rata' jika tidak ada items", () => {
    const noItems: SplitPersonData = { ...person, items: [] };
    const result = buildEscPosSplitPersonReceipt("ORD-001", noItems, 0, 2, 80000);
    const text = bytesToText(result);
    expect(text).toContain("Bagi rata");
  });

  it("menampilkan kembalian untuk pembayaran CASH", () => {
    const result = buildEscPosSplitPersonReceipt("ORD-001", person, 0, 2, 80000);
    const text = bytesToText(result);
    expect(text).toContain("Kembalian:");
    expect(text).toContain("Rp10");
  });

  it("tidak menampilkan kembalian untuk QRIS", () => {
    const qrisPerson: SplitPersonData = { ...person, method: "QRIS" };
    const result = buildEscPosSplitPersonReceipt("ORD-001", qrisPerson, 0, 2, 80000);
    const text = bytesToText(result);
    expect(text).toContain("QRIS");
    expect(text).not.toContain("Kembalian:");
  });
});

describe("buildEscPosSplitCombinedReceipt", () => {
  const items = [
    { name: "Rendang", quantity: 2, price: 35000 },
    { name: "Es Teh", quantity: 2, price: 5000 },
  ];

  const persons: SplitPersonData[] = [
    { label: "Andi", amount: 40000, method: "CASH", items: [] },
    { label: "Budi", amount: 40000, method: "QRIS", items: [] },
  ];

  it("mengembalikan Uint8Array", () => {
    const result = buildEscPosSplitCombinedReceipt("ORD-001", items, persons, 80000);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it("mengandung nama restoran", () => {
    const result = buildEscPosSplitCombinedReceipt("ORD-001", items, persons, 80000);
    const text = bytesToText(result);
    expect(text).toContain("RM. ETEK MINANG");
  });

  it("mengandung semua item pesanan", () => {
    const result = buildEscPosSplitCombinedReceipt("ORD-001", items, persons, 80000);
    const text = bytesToText(result);
    expect(text).toContain("Rendang");
    expect(text).toContain("Es Teh");
  });

  it("mengandung total", () => {
    const result = buildEscPosSplitCombinedReceipt("ORD-001", items, persons, 80000);
    const text = bytesToText(result);
    expect(text).toContain("TOTAL");
    expect(text).toContain("Rp80");
  });

  it("menampilkan header PEMBAGIAN TAGIHAN", () => {
    const result = buildEscPosSplitCombinedReceipt("ORD-001", items, persons, 80000);
    const text = bytesToText(result);
    expect(text).toContain("PEMBAGIAN TAGIHAN");
  });

  it("menampilkan nama semua orang", () => {
    const result = buildEscPosSplitCombinedReceipt("ORD-001", items, persons, 80000);
    const text = bytesToText(result);
    expect(text).toContain("Andi");
    expect(text).toContain("Budi");
  });

  it("menampilkan metode bayar per orang", () => {
    const result = buildEscPosSplitCombinedReceipt("ORD-001", items, persons, 80000);
    const text = bytesToText(result);
    expect(text).toContain("Tunai");
    expect(text).toContain("QRIS");
  });

  it("mengandung SPLIT BILL info", () => {
    const result = buildEscPosSplitCombinedReceipt("ORD-001", items, persons, 80000);
    const text = bytesToText(result);
    expect(text).toContain("SPLIT BILL");
    expect(text).toContain("2 org");
  });
});
