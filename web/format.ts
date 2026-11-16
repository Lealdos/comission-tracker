// How values read in the UI and how typed values parse back. Component files export only components
// (Vite's Fast Refresh needs that), so anything else the components share lives here.

import { formatCents, parseDollars, type DealLine } from "../shared/commission.ts";
import { toUTC } from "../shared/dates.ts";
import type { Deal } from "./api.ts";

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return toUTC(date).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

export function formatMonth(month: string): string {
  return formatDate(`${month}-01`, { month: "long", year: "numeric" });
}

export const SOURCE_LABEL = { service_drive: "Service drive", off_street: "Off-street" } as const;

/** Small pill tones used across lists: sale type, affiliate, minimum applied, missing details. */
export const tone = {
  positive: "border-transparent bg-positive-soft text-positive",
  neutral: "border-transparent bg-secondary text-muted-foreground",
  warning: "border-transparent bg-warning-soft text-warning",
} as const;

/** Parses a whole percent from 1 to 99 (a split's share); null for anything else. */
export function parseSplitPct(input: string): number | null {
  const cleaned = input.replace(/[%\s]/g, "");
  if (!/^\d{1,2}$/.test(cleaned)) return null;
  const pct = Number(cleaned);
  return pct >= 1 && pct <= 99 ? pct : null;
}

/** Parses a unit bonus into cents; null when it isn't a dollar amount or is negative. */
export function parseUnitBonus(input: string): number | null {
  const cents = parseDollars(input);
  return cents !== null && cents >= 0 ? cents : null;
}

/** How a deal's pay adds up, in one line: gross (plus DPB) times the rate, the minimum, any split, then any unit bonus. */
export function dealMath(line: DealLine, splitWith: string): string {
  const gross = line.dpbCents ? `(${formatCents(line.grossCents)} + ${formatCents(line.dpbCents, { whole: true })} DPB)` : formatCents(line.grossCents);
  let math = `${gross} × ${line.ratePct}% = ${formatCents(line.rawCommissionCents)}`;
  if (line.minimumApplied) math += `, so the ${formatCents(line.fullCommissionCents, { whole: true })} minimum applies`;
  if (line.splitPct !== null) math += `, minus ${splitWith ? `${splitWith}'s` : "their"} ${line.splitPct}% (${formatCents(line.splitCents)})`;
  if (line.unitBonusSplitCents) math += `, plus ${formatCents(line.unitBonusCents)} of the ${formatCents(line.unitBonusCents + line.unitBonusSplitCents)} unit bonus`;
  else if (line.unitBonusCents) math += `, plus ${formatCents(line.unitBonusCents)} unit bonus`;
  if (!line.countsForVolume) math += ". Not counted toward your volume";
  return math;
}

/** The delete confirmation for a deal: which one, and what it takes off the month. */
export function dealDeleteDescription(deal: Deal, line: DealLine | null | undefined): string {
  const which = `${deal.vehicle || "This deal"}${deal.customerName ? ` sold to ${deal.customerName}` : ""} on ${formatDate(deal.soldOn, { month: "long", day: "numeric" })}.`;
  if (!line) return which;
  return `${which} Its ${formatCents(line.payCents)} ${line.unitBonusCents ? "commission and unit bonus come" : "commission comes"} off this month.`;
}
