// The dealership pay plan as data. When the plan changes, add a new entry with a later
// `effectiveFrom` instead of editing an old one, so past months keep computing the same way.

export type VehicleType = "new" | "used";

export interface PayPlan {
  name: string;
  /** First day (YYYY-MM-DD) the plan applies to. A month uses the plan in effect on its 1st. */
  effectiveFrom: string;
  /**
   * Commission percent of commissionable gross, before tenure. Gross is entered as the dealership reports it,
   * already net of the plan's $500 management fee, so the fee isn't modeled here.
   */
  baseRatePct: Record<VehicleType, number>;
  /** Percentage points added once employed at least `afterYears`; steps are additive. */
  tenureSteps: { afterYears: number; addPct: number }[];
  minCommissionCents: Record<VehicleType, number>;
  /** Vehicle types that get the per-car Dealer Performance Bonus added to gross. */
  dpbAppliesTo: VehicleType[];
  /** Cumulative: every milestone reached in the month pays its bonus. */
  volumeMilestones: { units: number; bonusCents: number }[];
  /** Paid per vehicle bought from an off-street or service-drive customer. */
  acquisitionBonusCents: number;
  draw: {
    weekday: number;
    weeklyCents: number;
    trainingWeeklyCents: number;
    /** Draw days fewer than this many days after the hire date pay the training amount. */
    trainingDays: number;
    /** At most this many draw days count in a month, so a month with a 5th Friday still draws 4 weeks. */
    maxWeeksPerMonth: number;
  };
  /** Commission check lands on this day of the following month. */
  payoutDay: number;
}

export const PAY_PLANS: PayPlan[] = [
  {
    name: "Germain Hyundai Sales Compensation Plan",
    effectiveFrom: "2026-05-01",
    baseRatePct: { new: 16, used: 18 },
    tenureSteps: [
      { afterYears: 1, addPct: 1 },
      { afterYears: 2, addPct: 1 },
    ],
    minCommissionCents: { new: 250_00, used: 200_00 },
    dpbAppliesTo: ["new"],
    volumeMilestones: [
      { units: 13, bonusCents: 500_00 },
      { units: 16, bonusCents: 500_00 },
      { units: 19, bonusCents: 500_00 },
      { units: 22, bonusCents: 1_000_00 },
      { units: 26, bonusCents: 1_000_00 },
      { units: 30, bonusCents: 1_000_00 },
      { units: 35, bonusCents: 1_500_00 },
      { units: 40, bonusCents: 1_500_00 },
    ],
    acquisitionBonusCents: 200_00,
    // At most 4 weeks a month: $2,000, or $2,400 in the first 90 days (confirmed with the user).
    draw: { weekday: 5, weeklyCents: 500_00, trainingWeeklyCents: 600_00, trainingDays: 90, maxWeeksPerMonth: 4 },
    payoutDay: 10,
  },
];

/** The plan in effect on `date`; months before the first plan fall back to the earliest one. */
export function planForDate(date: string): PayPlan {
  const sorted = [...PAY_PLANS].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let plan = sorted[0]!;
  for (const p of sorted) if (p.effectiveFrom <= date) plan = p;
  return plan;
}
