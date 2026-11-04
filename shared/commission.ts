// The only place pay-plan rules are applied. Pure functions over integer cents so the
// server's month summary and the client's live deal preview always agree.

import { addDays, daysBetween, fullYearsBetween, monthStart, nextMonth, weekdaysInMonth } from "./dates.ts";
import { planForDate, type PayPlan, type VehicleType } from "./payplan.ts";

export interface DealInput {
  id: number;
  soldOn: string;
  vehicleType: VehicleType;
  grossCents: number;
  /** Split with another salesperson: the whole percent of the commission that goes to them. Null when not split. */
  splitPct: number | null;
  /** Whether a split deal still counts toward the volume bonus. An unsplit deal always does. */
  splitCountsForVolume: boolean;
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
  /** What this salesperson is paid: the full commission minus the split. */
  commissionCents: number;
  countsForVolume: boolean;
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
 * (so a 50% split of a minimum deal pays half the minimum).
 */
export function dealCommission(plan: PayPlan, deal: DealInput, hireDate: string, dpb: DpbSetting): DealLine {
  const whole = wholeDealCommission(plan, deal, hireDate, dpb);
  const keptCents = deal.splitPct === null ? whole.fullCommissionCents : Math.round((whole.fullCommissionCents * (100 - deal.splitPct)) / 100);
  return {
    id: deal.id,
    soldOn: deal.soldOn,
    vehicleType: deal.vehicleType,
    grossCents: deal.grossCents,
    ...whole,
    splitPct: deal.splitPct,
    splitCents: whole.fullCommissionCents - keptCents,
    commissionCents: keptCents,
    countsForVolume: deal.splitPct === null || deal.splitCountsForVolume,
  };
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
  acquisitionCount: number;
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

  // Split deals the salesperson chose not to count are left out of the units.
  const counted = deals.filter((d) => d.countsForVolume);
  const units = {
    new: counted.filter((d) => d.vehicleType === "new").length,
    used: counted.filter((d) => d.vehicleType === "used").length,
    total: counted.length,
  };

  const commissionCents = sum(deals.map((d) => d.commissionCents));
  const dpbAddedCents = sum(deals.map((d) => d.dpbCents));
  const volumeCents = volumeBonusCents(plan, units.total);
  const acquisitionCents = input.acquisitionCount * plan.acquisitionBonusCents;
  const spiffsCents = sum(input.spiffCents);
  const earningsCents = commissionCents + volumeCents + acquisitionCents + spiffsCents;

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
    acquisitions: { count: input.acquisitionCount, perCarCents: plan.acquisitionBonusCents, bonusCents: acquisitionCents },
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
