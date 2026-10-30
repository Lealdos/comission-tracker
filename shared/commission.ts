// The only place pay-plan rules are applied. Pure functions over integer cents so the
// server's month summary and the client's live deal preview always agree.

import { addDays, daysBetween, fullYearsBetween, monthStart, nextMonth, weekdaysInMonth } from "./dates.ts";
import { planForDate, type PayPlan, type VehicleType } from "./payplan.ts";

export interface DealInput {
  id: number;
  soldOn: string;
  vehicleType: VehicleType;
  grossCents: number;
  /** Sold at an affiliated store: counts toward volume, paid on that store's plan. */
  affiliateStore: boolean;
  affiliateCommissionCents: number | null;
}

export interface DpbSetting {
  qualified: boolean;
  perCarCents: number;
}

export interface DealLine {
  id: number;
  soldOn: string;
  vehicleType: VehicleType;
  affiliateStore: boolean;
  grossCents: number;
  dpbCents: number;
  /** Gross plus DPB. */
  commissionableCents: number;
  ratePct: number;
  /** Rate times commissionable gross, before the per-deal minimum. */
  rawCommissionCents: number;
  commissionCents: number;
  minimumApplied: boolean;
}

export function tenureAddPct(plan: PayPlan, hireDate: string, on: string): number {
  const years = fullYearsBetween(hireDate, on);
  return plan.tenureSteps.reduce((sum, s) => (years >= s.afterYears ? sum + s.addPct : sum), 0);
}

export function dealRatePct(plan: PayPlan, vehicleType: VehicleType, hireDate: string, soldOn: string): number {
  return plan.baseRatePct[vehicleType] + tenureAddPct(plan, hireDate, soldOn);
}

export function dealCommission(plan: PayPlan, deal: DealInput, hireDate: string, dpb: DpbSetting): DealLine {
  const base = { id: deal.id, soldOn: deal.soldOn, vehicleType: deal.vehicleType, affiliateStore: deal.affiliateStore, grossCents: deal.grossCents };

  if (deal.affiliateStore) {
    const paid = deal.affiliateCommissionCents ?? 0;
    return { ...base, dpbCents: 0, commissionableCents: 0, ratePct: 0, rawCommissionCents: paid, commissionCents: paid, minimumApplied: false };
  }

  const dpbCents = dpb.qualified && plan.dpbAppliesTo.includes(deal.vehicleType) ? dpb.perCarCents : 0;
  const commissionableCents = deal.grossCents + dpbCents;
  const ratePct = dealRatePct(plan, deal.vehicleType, hireDate, deal.soldOn);
  const rawCommissionCents = Math.round((commissionableCents * ratePct) / 100);
  const minCents = plan.minCommissionCents[deal.vehicleType];
  const minimumApplied = rawCommissionCents < minCents;

  return {
    ...base,
    dpbCents,
    commissionableCents,
    ratePct,
    rawCommissionCents,
    commissionCents: minimumApplied ? minCents : rawCommissionCents,
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

  const units = {
    new: deals.filter((d) => d.vehicleType === "new").length,
    used: deals.filter((d) => d.vehicleType === "used").length,
    total: deals.length,
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
