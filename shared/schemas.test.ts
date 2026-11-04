import { describe, expect, test } from "bun:test";
import { dealBody, dealPatch } from "./schemas.ts";

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
