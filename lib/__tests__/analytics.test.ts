import { parseDateRange, getPreviousPeriod } from "../analytics";

describe("parseDateRange", () => {
  it("menggunakan tanggal yang diberikan", () => {
    const { start, end } = parseDateRange("2025-06-01", "2025-06-07");
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(5); // June = 5
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(7);
  });

  it("set start ke 00:00:00.000 dan end ke 23:59:59.999", () => {
    const { start, end } = parseDateRange("2025-06-01", "2025-06-07");
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  it("default end ke hari ini jika null", () => {
    const { end } = parseDateRange("2025-06-01", null);
    const today = new Date();
    expect(end.getDate()).toBe(today.getDate());
  });

  it("default start ke 7 hari sebelum end jika null", () => {
    const { start, end } = parseDateRange(null, "2025-06-15");
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(7);
  });

  it("kedua null: end = hari ini, start = 7 hari lalu", () => {
    const { start, end } = parseDateRange(null, null);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(7);
  });
});

describe("getPreviousPeriod", () => {
  it("mengembalikan periode sebelumnya dengan durasi sama", () => {
    const start = new Date("2025-06-08T00:00:00");
    const end = new Date("2025-06-14T23:59:59.999");
    const { prevStart, prevEnd } = getPreviousPeriod(start, end);

    expect(prevEnd.getTime()).toBeLessThan(start.getTime());
    expect(prevEnd.getHours()).toBe(23);
    expect(prevEnd.getMinutes()).toBe(59);
    expect(prevStart.getHours()).toBe(0);
    expect(prevStart.getMinutes()).toBe(0);
  });

  it("durasi prevStart-prevEnd sama dengan start-end", () => {
    const start = new Date("2025-06-08T00:00:00");
    const end = new Date("2025-06-14T23:59:59.999");
    const { prevStart, prevEnd } = getPreviousPeriod(start, end);

    const originalDiff = end.getTime() - start.getTime();
    const prevDiff = prevEnd.getTime() - prevStart.getTime();
    expect(Math.abs(originalDiff - prevDiff)).toBeLessThan(86400000);
  });

  it("prevEnd tepat sebelum start (hari sebelumnya)", () => {
    const start = new Date("2025-06-08T00:00:00");
    const end = new Date("2025-06-14T23:59:59.999");
    const { prevEnd } = getPreviousPeriod(start, end);
    expect(prevEnd.getDate()).toBe(7);
    expect(prevEnd.getMonth()).toBe(5);
  });
});
