import { formatRupiah, generateOrderNumber, isLowStock, cn } from "../utils";

describe("formatRupiah", () => {
  it("memformat angka ke format Rupiah", () => {
    expect(formatRupiah(50000)).toBe("Rp 50.000");
  });

  it("memformat angka 0", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
  });

  it("memformat angka besar", () => {
    expect(formatRupiah(1500000)).toBe("Rp 1.500.000");
  });

  it("memformat angka negatif", () => {
    expect(formatRupiah(-25000)).toMatch(/-Rp\s*25\.000/);
  });
});

describe("generateOrderNumber", () => {
  it("menghasilkan format ORD-YYYYMMDD-XXXXX", () => {
    const result = generateOrderNumber(1);
    expect(result).toMatch(/^ORD-\d{8}-\d{3,5}$/);
  });

  it("menggunakan tanggal hari ini", () => {
    const now = new Date();
    const y = now.getFullYear().toString();
    const m = (now.getMonth() + 1).toString().padStart(2, "0");
    const d = now.getDate().toString().padStart(2, "0");
    const result = generateOrderNumber(5);
    expect(result).toContain(`ORD-${y}${m}${d}-`);
  });

  it("meng-pad sequence ke 3 digit", () => {
    const result = generateOrderNumber(1);
    expect(result).toMatch(/^ORD-\d{8}-001\d{2}$/);
  });

  it("menghasilkan nomor berbeda tiap pemanggilan (random suffix)", () => {
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(generateOrderNumber(1));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("isLowStock", () => {
  it("mengembalikan true saat stock di bawah 25% dari initial", () => {
    expect(isLowStock(2, 100)).toBe(true);
  });

  it("mengembalikan true saat stock tepat di threshold", () => {
    expect(isLowStock(25, 100)).toBe(true);
  });

  it("mengembalikan false saat stock di atas threshold", () => {
    expect(isLowStock(50, 100)).toBe(false);
  });

  it("mengembalikan true saat stock 0", () => {
    expect(isLowStock(0, 100)).toBe(true);
  });

  it("mendukung custom threshold", () => {
    expect(isLowStock(15, 100, 0.1)).toBe(false);
    expect(isLowStock(5, 100, 0.1)).toBe(true);
  });
});

describe("cn", () => {
  it("menggabungkan class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("menangani conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("merge tailwind classes (last wins)", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });
});
