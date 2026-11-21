// The only place pay-plan rules are applied. Pure functions over integer cents so the
// server's month summary and the client's live deal preview always agree.

import { addDays, daysBetween, fullYearsBetween, monthStart, nextMonth, weekdaysInMonth } from "./dates.ts";
import { planForDate, type PayPlan, type VehicleType } from "./payplan.ts";

/** On a split deal, whose volume count the car adds to. */
export const SPLIT_UNITS = ["mine", "half", "theirs"] as const;
export type SplitUnit = (typeof SPLIT_UNITS)[number];

/** How much of the car counts toward this salesperson's volume bonus for each choice. */
const SPLIT_UNIT_SHARE: Record<SplitUnit, number> = { mine: 1, half: 0.5, theirs: 0 };

export interface DealInput {
  id: number;
  soldOn: string;
  vehicleType: VehicleType;
  grossCents: number;
  /** Split with another salesperson: the whole percent of the commission that goes to them. Null when not split. */
  splitPct: number | null;
  /** On a split deal, whether the car counts toward this salesperson's volume as a whole unit, half a unit or not at all. An unsplit deal always counts whole. */
  splitUnit: SplitUnit;
  /** A one-off bonus for this particular car, the whole amount; 0 when there's none. */
  unitBonusCents: number;
  /** On a split deal, whether the unit bonus was for both salespeople (then it's split too) or all this salesperson's. */
  unitBonusShared: boolean;
}

/** A car bought from a customer: the plan's flat bonus, plus any bonus for that particular car. */
export interface AcquisitionInput {
  unitBonusCents: number;
}

export interface DpbSetting {
  qualified: boolean;
  perCarCents: number;
}

export interface DealLine {
  id: number;
  soldOn: string;
  vehicleType: VehicleType;
  grossCents: number;
  dpbCents: number;
  /** Gross plus DPB. */
  commissionableCents: number;
  ratePct: number;
  /** Rate times commissionable gross, before the per-deal minimum. */
  rawCommissionCents: number;
  /** What the whole deal pays (minimum applied), before any split. */
  fullCommissionCents: number;
  minimumApplied: boolean;
  splitPct: number | null;
  /** The other salesperson's part of the full commission. */
  splitCents: number;
  /** What this salesperson is paid in commission: the full commission minus the split. */
  commissionCents: number;
  /** This salesperson's part of the unit bonus, on top of the commission: not run through the rate or the minimum. */
  unitBonusCents: number;
  /** The other salesperson's part of the unit bonus, when it was for both of them. */
  unitBonusSplitCents: number;
  /** Everything this deal pays this salesperson: commission plus their part of the unit bonus. */
  payCents: number;
  /** How much of a unit this deal adds toward the volume bonus: 1, or 0.5 or 0 on a split deal. */
  volumeUnits: number;
}

export function tenureAddPct(plan: PayPlan, hireDate: string, on: string): number {
  const years = fullYearsBetween(hireDate, on);
  return plan.tenureSteps.reduce((sum, s) => (years >= s.afterYears ? sum + s.addPct : sum), 0);
}

export function dealRatePct(plan: PayPlan, vehicleType: VehicleType, hireDate: string, soldOn: string): number {
  return plan.baseRatePct[vehicleType] + tenureAddPct(plan, hireDate, soldOn);
}

/**
 * What a deal pays this salesperson. A sale at an affiliated store pays on this plan like any other, so it isn't an input here.
 * A split takes the other salesperson's percent off the whole deal's commission, after the minimum and the DPB
 * (so a 50% split of a minimum deal pays half the minimum). A unit bonus is added after all of that: whole, or split by
 * the same percent when the salesperson says it was for both of them.
 */
export function dealCommission(plan: PayPlan, deal: DealInput, hireDate: string, dpb: DpbSetting): DealLine {
  const whole = wholeDealCommission(plan, deal, hireDate, dpb);
  const keptCents = keptShare(whole.fullCommissionCents, deal.splitPct);
  const keptBonusCents = deal.unitBonusShared ? keptShare(deal.unitBonusCents, deal.splitPct) : deal.unitBonusCents;
  return {
    id: deal.id,
    soldOn: deal.soldOn,
    vehicleType: deal.vehicleType,
    grossCents: deal.grossCents,
    ...whole,
    splitPct: deal.splitPct,
    splitCents: whole.fullCommissionCents - keptCents,
    commissionCents: keptCents,
    unitBonusCents: keptBonusCents,
    unitBonusSplitCents: deal.unitBonusCents - keptBonusCents,
    payCents: keptCents + keptBonusCents,
    volumeUnits: deal.splitPct === null ? 1 : SPLIT_UNIT_SHARE[deal.splitUnit],
  };
}

/** What this salesperson keeps of `cents` once the other salesperson's percent comes off, rounded to the cent. */
function keptShare(cents: number, splitPct: number | null): number {
  return splitPct === null ? cents : Math.round((cents * (100 - splitPct)) / 100);
}

function wholeDealCommission(plan: PayPlan, deal: DealInput, hireDate: string, dpb: DpbSetting) {
  const dpbCents = dpb.qualified && plan.dpbAppliesTo.includes(deal.vehicleType) ? dpb.perCarCents : 0;
  const commissionableCents = deal.grossCents + dpbCents;
  const ratePct = dealRatePct(plan, deal.vehicleType, hireDate, deal.soldOn);
  const rawCommissionCents = Math.round((commissionableCents * ratePct) / 100);
  const minCents = plan.minCommissionCents[deal.vehicleType];
  const minimumApplied = rawCommissionCents < minCents;

  return {
    dpbCents,
    commissionableCents,
    ratePct,
    rawCommissionCents,
    fullCommissionCents: minimumApplied ? minCents : rawCommissionCents,
    minimumApplied,
  };
}

export function volumeBonusCents(plan: PayPlan, units: number): number {
  return plan.volumeMilestones.reduce((sum, m) => (units >= m.units ? sum + m.bonusCents : sum), 0);
}

export function nextMilestone(plan: PayPlan, units: number) {
  const m = plan.volumeMilestones.find((m) => units < m.units);
  return m ? { ...m, unitsToGo: m.units - units } : null;
}

export interface DrawWeek {
  date: string;
  cents: number;
  training: boolean;
}

/** Scheduled weekly draws in the month: none before the hire date, and only the first `maxWeeksPerMonth` draw days count. */
export function scheduledDraws(plan: PayPlan, month: string, hireDate: string): DrawWeek[] {
  return weekdaysInMonth(month, plan.draw.weekday)
    .filter((date) => date >= hireDate)
    .slice(0, plan.draw.maxWeeksPerMonth)
    .map((date) => {
      const training = daysBetween(hireDate, date) < plan.draw.trainingDays;
      return { date, training, cents: training ? plan.draw.trainingWeeklyCents : plan.draw.weeklyCents };
    });
}

export interface MonthInput {
  month: string;
  hireDate: string;
  deals: DealInput[];
  acquisitions: AcquisitionInput[];
  spiffCents: number[];
  dpb: DpbSetting;
  /** Total draws actually paid, when it differs from the schedule. */
  drawOverrideCents: number | null;
}

export function monthSummary(input: MonthInput) {
  const plan = planForDate(monthStart(input.month));
  const deals = [...input.deals]
    .sort((a, b) => a.soldOn.localeCompare(b.soldOn) || a.id - b.id)
    .map((d) => dealCommission(plan, d, input.hireDate, input.dpb));

  // A split deal adds the part of the unit the salesperson chose (all, half or none), so units can end in .5.
  const units = {
    new: sum(deals.filter((d) => d.vehicleType === "new").map((d) => d.volumeUnits)),
    used: sum(deals.filter((d) => d.vehicleType === "used").map((d) => d.volumeUnits)),
    total: sum(deals.map((d) => d.volumeUnits)),
  };

  const commissionCents = sum(deals.map((d) => d.commissionCents));
  const dpbAddedCents = sum(deals.map((d) => d.dpbCents));
  const volumeCents = volumeBonusCents(plan, units.total);
  const acquisitionCents = input.acquisitions.length * plan.acquisitionBonusCents;
  // One-off bonuses on particular cars, sold or bought: their own line, so the plan's lines still match the dealership's sheet.
  const dealUnitBonuses = deals.filter((d) => d.unitBonusCents > 0);
  const carUnitBonuses = input.acquisitions.filter((a) => a.unitBonusCents > 0);
  const unitBonusCents = sum(dealUnitBonuses.map((d) => d.unitBonusCents)) + sum(carUnitBonuses.map((a) => a.unitBonusCents));
  const spiffsCents = sum(input.spiffCents);
  const earningsCents = commissionCents + volumeCents + acquisitionCents + unitBonusCents + spiffsCents;

  const drawWeeks = scheduledDraws(plan, input.month, input.hireDate);
  const scheduledDrawCents = sum(drawWeeks.map((w) => w.cents));
  const drawCents = input.drawOverrideCents ?? scheduledDrawCents;

  return {
    month: input.month,
    plan: { name: plan.name, effectiveFrom: plan.effectiveFrom },
    deals,
    units,
    commissionCents,
    dpb: { ...input.dpb, addedCents: dpbAddedCents },
    volume: {
      bonusCents: volumeCents,
      milestones: plan.volumeMilestones.map((m) => ({ ...m, reached: units.total >= m.units })),
      next: nextMilestone(plan, units.total),
    },
    acquisitions: { count: input.acquisitions.length, perCarCents: plan.acquisitionBonusCents, bonusCents: acquisitionCents },
    unitBonuses: { deals: dealUnitBonuses.length, carsBought: carUnitBonuses.length, totalCents: unitBonusCents },
    spiffsCents,
    earningsCents,
    draws: { weeks: drawWeeks, maxWeeks: plan.draw.maxWeeksPerMonth, scheduledCents: scheduledDrawCents, overridden: input.drawOverrideCents !== null, totalCents: drawCents },
    /** What arrives on payday after the month's draws are taken back. */
    checkCents: Math.max(0, earningsCents - drawCents),
    /** The draw is a guarantee, so the month never pays less than the draws. */
    totalIncomeCents: Math.max(earningsCents, drawCents),
    payDate: `${nextMonth(input.month)}-${String(plan.payoutDay).padStart(2, "0")}`,
    tenure: {
      years: fullYearsBetween(input.hireDate, monthStart(input.month)),
      addPct: tenureAddPct(plan, input.hireDate, monthStart(input.month)),
      trainingDrawEnds: addDays(input.hireDate, plan.draw.trainingDays),
    },
  };
}

export type MonthSummary = ReturnType<typeof monthSummary>;

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function formatCents(cents: number, opts: { whole?: boolean } = {}): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.whole ? 0 : 2,
    maximumFractionDigits: opts.whole ? 0 : 2,
  });
}

/** Parses "1,234.56" / "$-300" / "-300" into cents; returns null for anything else. */
export function parseDollars(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
