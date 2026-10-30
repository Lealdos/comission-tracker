// Request bodies, shared so the API validates exactly what the web forms send.

import { z } from "zod";

const isoDate = z.iso.date();
const cents = z.number().int().min(-10_000_000_00).max(10_000_000_00);

export const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be YYYY-MM");

// Email and password belong to Neon Auth; the app profile is what the pay plan needs.
export const profileCreateBody = z.object({
  name: z.string().trim().min(1).max(100),
  hireDate: isoDate,
});

export const profileBody = profileCreateBody.partial();

/** Who the customer was and which vehicle are required on every deal and car bought, so each one can be traced later. */
const customerName = z.string().trim().min(1, "Enter the customer's name").max(200);
const vehicle = z.string().trim().min(1, "Enter the vehicle").max(200);

const dealFields = z.object({
  soldOn: isoDate,
  vehicleType: z.enum(["new", "used"]),
  grossCents: cents,
  customerName,
  vehicle,
  stockNumber: z.string().trim().max(200),
  affiliateStore: z.boolean(),
  affiliateCommissionCents: cents.nullable(),
  notes: z.string().trim().max(2000),
});

export const dealBody = dealFields.extend({
  stockNumber: dealFields.shape.stockNumber.default(""),
  affiliateStore: dealFields.shape.affiliateStore.default(false),
  affiliateCommissionCents: dealFields.shape.affiliateCommissionCents.default(null),
  notes: dealFields.shape.notes.default(""),
});

/** Built from the default-free fields: zod 4 applies defaults inside .partial(), which would wipe unsent fields. */
export const dealPatch = dealFields.partial();

export const acquisitionBody = z.object({
  acquiredOn: isoDate,
  source: z.enum(["off_street", "service_drive"]),
  customerName,
  vehicle,
});

export const spiffBody = z.object({
  paidOn: isoDate,
  amountCents: cents,
  note: z.string().trim().max(200).default(""),
});

export const monthSettingsBody = z.object({
  dpbQualified: z.boolean(),
  dpbPerCarCents: z.number().int().min(0).max(100_000_00),
  drawOverrideCents: z.number().int().min(0).max(100_000_00).nullable(),
});

export type DealBody = z.input<typeof dealBody>;
export type AcquisitionBody = z.input<typeof acquisitionBody>;
export type SpiffBody = z.input<typeof spiffBody>;
export type MonthSettingsBody = z.infer<typeof monthSettingsBody>;
