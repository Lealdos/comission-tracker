import { describe, expect, test } from "bun:test";
import { acquisitionBody, dealBody, dealPatch } from "./schemas.ts";

const sale = { soldOn: "2026-06-15", vehicleType: "new", grossCents: 3000_00, customerName: "Ana Ruiz", vehicle: "2026 Tucson SEL" } as const;

describe("affiliated-store sales", () => {
  test("a sale at an affiliated store needs the store's name", () => {
    expect(dealBody.safeParse({ ...sale, affiliateStore: true }).success).toBe(false);
    expect(dealBody.safeParse({ ...sale, affiliateStore: true, affiliateStoreName: "  " }).success).toBe(false);
    expect(dealBody.parse({ ...sale, affiliateStore: true, affiliateStoreName: " Germain Toyota " }).affiliateStoreName).toBe("Germain Toyota");
  });

  test("a sale at this store keeps no affiliated store name", () => {
    expect(dealBody.parse({ ...sale, affiliateStoreName: "Germain Toyota" }).affiliateStoreName).toBe("");
  });

  test("a PATCH turning an affiliate sale on sends the store; turning it off clears it", () => {
    expect(dealPatch.safeParse({ affiliateStore: true }).success).toBe(false);
    expect(dealPatch.parse({ affiliateStore: false })).toEqual({ affiliateStore: false, affiliateStoreName: "" });
    // A PATCH that doesn't touch the flag leaves the store alone.
    expect(dealPatch.parse({ notes: "Delivered Friday" })).toEqual({ notes: "Delivered Friday" });
  });
});

describe("customer phone", () => {
  test("is optional", () => {
    expect(dealBody.parse(sale).customerPhone).toBe("");
    expect(dealBody.parse({ ...sale, customerPhone: "  " }).customerPhone).toBe("");
  });

  test("US numbers are stored formatted, whatever the separators", () => {
    for (const typed of ["8015550142", "801-555-0142", "801.555.0142", "(801) 555 0142", "+1 801 555 0142", "18015550142"]) {
      expect(dealBody.parse({ ...sale, customerPhone: typed }).customerPhone).toBe("(801) 555-0142");
    }
  });

  test("other numbers stay as typed", () => {
    expect(dealBody.parse({ ...sale, customerPhone: " +52 33 1234 5678 " }).customerPhone).toBe("+52 33 1234 5678");
    // A + with 10 digits is a foreign number, not a US one.
    expect(dealBody.parse({ ...sale, customerPhone: "+49 30 123456" }).customerPhone).toBe("+49 30 123456");
    expect(dealBody.parse({ ...sale, customerPhone: "555-0142" }).customerPhone).toBe("555-0142");
  });

  test("rejects what isn't a phone number", () => {
    for (const typed of ["call me", "555-01", "801 555 0142 ext 3", "1234567890123456", "801+555+0142"]) {
      expect(dealBody.safeParse({ ...sale, customerPhone: typed }).success).toBe(false);
    }
  });

  test("a PATCH can change or clear it, and leaves it alone otherwise", () => {
    expect(dealPatch.parse({ customerPhone: "801 555 0142" })).toEqual({ customerPhone: "(801) 555-0142" });
    expect(dealPatch.parse({ customerPhone: "" })).toEqual({ customerPhone: "" });
    expect(dealPatch.parse({ notes: "x" })).toEqual({ notes: "x" });
  });
});

describe("gross", () => {
  test("a deal can be logged with a negative gross (it still pays the minimum)", () => {
    expect(dealBody.parse({ ...sale, grossCents: -1500_00 }).grossCents).toBe(-1500_00);
    expect(dealPatch.parse({ grossCents: -42_50 })).toEqual({ grossCents: -42_50 });
  });
});

describe("unit bonus", () => {
  const carBought = { acquiredOn: "2026-06-15", source: "service_drive", customerName: "Ana Ruiz", vehicle: "2019 Camry" } as const;

  test("deals and cars bought have none unless one is sent", () => {
    expect(dealBody.parse(sale).unitBonusCents).toBe(0);
    expect(acquisitionBody.parse(carBought).unitBonusCents).toBe(0);
    expect(dealBody.parse({ ...sale, unitBonusCents: 300_00 }).unitBonusCents).toBe(300_00);
    expect(acquisitionBody.parse({ ...carBought, unitBonusCents: 100_00 }).unitBonusCents).toBe(100_00);
  });

  test("can't be negative or fractional cents", () => {
    expect(dealBody.safeParse({ ...sale, unitBonusCents: -1 }).success).toBe(false);
    expect(dealBody.safeParse({ ...sale, unitBonusCents: 10.5 }).success).toBe(false);
    expect(acquisitionBody.safeParse({ ...carBought, unitBonusCents: -100 }).success).toBe(false);
  });

  test("a PATCH that doesn't send it leaves it alone", () => {
    expect(dealPatch.parse({ notes: "x" })).toEqual({ notes: "x" });
  });

  test("whether it's for both only sticks with a split and a bonus", () => {
    const split = { splitPct: 50, splitWith: "Chris Dalton" };
    expect(dealBody.parse({ ...sale, ...split, unitBonusCents: 200_00, unitBonusShared: true }).unitBonusShared).toBe(true);
    expect(dealBody.parse({ ...sale, unitBonusCents: 200_00, unitBonusShared: true }).unitBonusShared).toBe(false);
    expect(dealBody.parse({ ...sale, ...split, unitBonusShared: true }).unitBonusShared).toBe(false);
    // Removing the split or the bonus in a PATCH clears it too.
    expect(dealPatch.parse({ splitPct: null }).unitBonusShared).toBe(false);
    expect(dealPatch.parse({ unitBonusCents: 0 })).toEqual({ unitBonusCents: 0, unitBonusShared: false });
  });
});
