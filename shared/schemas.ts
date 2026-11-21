// Request bodies, shared so the API validates exactly what the web forms send.

import { z } from "zod";
import { SPLIT_UNITS } from "./commission.ts";
import { formatPhone, isPhone } from "./phone.ts";

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
/** The buyer's phone, optional ("" when not given); US numbers are stored as "(801) 555-0142". */
const customerPhone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || isPhone(v), "Enter a phone number with 7 to 15 digits")
  .transform(formatPhone);
/** A one-off bonus for one particular car, sold or bought, paid on top of the plan; 0 when there's none. */
const unitBonusCents = z.number().int().min(0, "A unit bonus can't be negative").max(100_000_00);

const dealFields = z.object({
  soldOn: isoDate,
  vehicleType: z.enum(["new", "used"]),
  grossCents: cents,
  customerName,
  customerPhone,
  vehicle,
  stockNumber: z.string().trim().max(200),
  /** Sold at an affiliated Germain store; it still pays on this store's plan. */
  affiliateStore: z.boolean(),
  /** Which affiliated store; "" when the sale was at this store. */
  affiliateStoreName: z.string().trim().max(200),
  /** Whole percent of the commission that goes to the other salesperson; null when the deal isn't split. */
  splitPct: z.number().int().min(1, "A split gives away 1% to 99%").max(99, "A split gives away 1% to 99%").nullable(),
  splitWith: z.string().trim().max(200),
  /** On a split deal, whether the car counts toward this salesperson's volume whole, as half a unit, or goes to the other salesperson. */
  splitUnit: z.enum(SPLIT_UNITS),
  unitBonusCents,
  /** On a split deal, whether the unit bonus was for both salespeople, so the split percent comes off it too. */
  unitBonusShared: z.boolean(),
  notes: z.string().trim().max(2000),
});

type DependentFields = {
  affiliateStore?: boolean;
  affiliateStoreName?: string;
  splitPct?: number | null;
  splitWith?: string;
  splitUnit?: (typeof SPLIT_UNITS)[number];
  unitBonusCents?: number;
  unitBonusShared?: boolean;
};

/** An affiliate sale has to say which store, so a PATCH that turns one on sends the store too. */
const namesStore = (d: DependentFields) => d.affiliateStore !== true || !!d.affiliateStoreName;
const storeMissing = { path: ["affiliateStoreName"], message: "Enter which affiliated store you sold it at" };

/** A split has to say who it was with, so a PATCH that sets one sends the name too. */
const namesPartner = (d: DependentFields) => d.splitPct == null || !!d.splitWith;
const partnerMissing = { path: ["splitWith"], message: "Enter who you split the deal with" };

/** Turning off an affiliate sale, a split or a unit bonus clears what depended on it, so no row keeps a stale store, partner or choice. */
function clearUnset<T extends DependentFields>(d: T): T {
  let out = d;
  if (out.affiliateStore === false) out = { ...out, affiliateStoreName: "" };
  if (out.splitPct === null) out = { ...out, splitWith: "", splitUnit: "mine", unitBonusShared: false };
  if (out.unitBonusCents === 0) out = { ...out, unitBonusShared: false };
  return out;
}

export const dealBody = dealFields
  .extend({
    customerPhone: customerPhone.default(""),
    stockNumber: dealFields.shape.stockNumber.default(""),
    affiliateStore: dealFields.shape.affiliateStore.default(false),
    affiliateStoreName: dealFields.shape.affiliateStoreName.default(""),
    splitPct: dealFields.shape.splitPct.default(null),
    splitWith: dealFields.shape.splitWith.default(""),
    splitUnit: dealFields.shape.splitUnit.default("mine"),
    unitBonusCents: unitBonusCents.default(0),
    unitBonusShared: dealFields.shape.unitBonusShared.default(false),
    notes: dealFields.shape.notes.default(""),
  })
  .refine(namesStore, storeMissing)
  .refine(namesPartner, partnerMissing)
  .transform(clearUnset);

/** Built from the default-free fields: zod 4 applies defaults inside .partial(), which would wipe unsent fields. */
export const dealPatch = dealFields
  .partial()
  .refine(namesStore, storeMissing)
  .refine(namesPartner, partnerMissing)
  .transform(clearUnset);

export const acquisitionBody = z.object({
  acquiredOn: isoDate,
  source: z.enum(["off_street", "service_drive"]),
  customerName,
  vehicle,
  unitBonusCents: unitBonusCents.default(0),
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
