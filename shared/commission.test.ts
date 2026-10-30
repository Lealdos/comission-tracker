import { describe, expect, test } from "bun:test";
import { dealCommission, monthSummary, parseDollars, scheduledDraws, volumeBonusCents, nextMilestone, type DealInput } from "./commission.ts";
import { planForDate } from "./payplan.ts";

const plan = planForDate("2026-05-01");
const NO_DPB = { qualified: false, perCarCents: 0 };
// Under a year of tenure at every sale date below unless a test says otherwise.
const HIRE = "2026-01-01";

let nextId = 1;
function deal(vehicleType: "new" | "used", grossDollars: number, extra: Partial<DealInput> = {}): DealInput {
  return { id: nextId++, soldOn: "2026-06-15", vehicleType, grossCents: grossDollars * 100, affiliateStore: false, affiliateCommissionCents: null, ...extra };
}

describe("dealCommission", () => {
  test("new: 16% of the entered gross, which already has the management fee taken out", () => {
    const line = dealCommission(plan, deal("new", 3000), HIRE, NO_DPB);
    expect(line.commissionableCents).toBe(3000_00);
    expect(line.ratePct).toBe(16);
    expect(line.commissionCents).toBe(480_00);
    expect(line.minimumApplied).toBe(false);
  });

  test("new: $250 minimum when 16% comes in under it", () => {
    const line = dealCommission(plan, deal("new", 1500), HIRE, NO_DPB);
    expect(line.rawCommissionCents).toBe(240_00);
    expect(line.commissionCents).toBe(250_00);
    expect(line.minimumApplied).toBe(true);
  });

  test("used: 18% of gross", () => {
    expect(dealCommission(plan, deal("used", 2500), HIRE, NO_DPB).commissionCents).toBe(450_00);
  });

  test("used: negative gross still pays the $200 minimum", () => {
    const line = dealCommission(plan, deal("used", -300), HIRE, NO_DPB);
    expect(line.commissionCents).toBe(200_00);
    expect(line.minimumApplied).toBe(true);
  });

  test("tenure adds 1 point after one year and 2 after two", () => {
    expect(dealCommission(plan, deal("new", 3000), "2025-05-15", NO_DPB).commissionCents).toBe(510_00);
    expect(dealCommission(plan, deal("new", 3000), "2024-05-15", NO_DPB).commissionCents).toBe(540_00);
    expect(dealCommission(plan, deal("used", 2500), "2024-05-15", NO_DPB).ratePct).toBe(20);
  });

  test("tenure counts from the anniversary date itself", () => {
    expect(dealCommission(plan, deal("new", 3000, { soldOn: "2026-06-15" }), "2025-06-15", NO_DPB).ratePct).toBe(17);
    expect(dealCommission(plan, deal("new", 3000, { soldOn: "2026-06-14" }), "2025-06-15", NO_DPB).ratePct).toBe(16);
  });

  test("Dealer Performance Bonus is added to new-vehicle gross only", () => {
    const dpb = { qualified: true, perCarCents: 800_00 };
    expect(dealCommission(plan, deal("new", 2000), HIRE, dpb).commissionCents).toBe(448_00);
    expect(dealCommission(plan, deal("used", 2500), HIRE, dpb).commissionCents).toBe(450_00);
  });

  test("DPB amount is ignored when the month is not qualified", () => {
    const line = dealCommission(plan, deal("new", 2000), HIRE, { qualified: false, perCarCents: 800_00 });
    expect(line.dpbCents).toBe(0);
    expect(line.commissionCents).toBe(320_00);
  });

  test("affiliated-store deals pay the entered commission", () => {
    const line = dealCommission(plan, deal("new", 3000, { affiliateStore: true, affiliateCommissionCents: 312_50 }), HIRE, NO_DPB);
    expect(line.commissionCents).toBe(312_50);
    expect(line.minimumApplied).toBe(false);
  });
});

describe("volume bonus", () => {
  test.each([
    [12, 0],
    [13, 500_00],
    [16, 1000_00],
    [19, 1500_00],
    [22, 2500_00],
    [30, 4500_00],
    [35, 6000_00],
    [40, 7500_00],
    [55, 7500_00],
  ])("%i units pays %i cents", (units, cents) => {
    expect(volumeBonusCents(plan, units)).toBe(cents);
  });

  test("next milestone and units to go", () => {
    expect(nextMilestone(plan, 10)).toEqual({ units: 13, bonusCents: 500_00, unitsToGo: 3 });
    expect(nextMilestone(plan, 13)).toEqual({ units: 16, bonusCents: 500_00, unitsToGo: 3 });
    expect(nextMilestone(plan, 40)).toBeNull();
  });
});

describe("draws", () => {
  test("$500 every Friday once past training, at most 4 a month (May 2026 has 5 Fridays)", () => {
    const weeks = scheduledDraws(plan, "2026-05", "2025-01-01");
    expect(weeks.map((w) => w.date)).toEqual(["2026-05-01", "2026-05-08", "2026-05-15", "2026-05-22"]);
    expect(weeks.reduce((s, w) => s + w.cents, 0)).toBe(2000_00);
  });

  test("$600 training draw for the first 90 days, at most 4 a month", () => {
    const may = scheduledDraws(plan, "2026-05", "2026-05-01");
    expect(may.map((w) => w.cents)).toEqual([600_00, 600_00, 600_00, 600_00]);
    expect(may.reduce((s, w) => s + w.cents, 0)).toBe(2400_00);
  });

  test("training ends 90 days after hire; a 5th Friday never counts", () => {
    // Hired May 15: Friday Aug 14 is day 91, so August's first Friday (Aug 7) is the last training draw.
    expect(scheduledDraws(plan, "2026-08", "2026-05-15").map((w) => w.cents)).toEqual([600_00, 500_00, 500_00, 500_00]);
    // July 2026 has 5 Fridays, all in training for a May 1 hire except the last, which isn't counted.
    expect(scheduledDraws(plan, "2026-07", "2026-05-01").map((w) => w.date)).toEqual(["2026-07-03", "2026-07-10", "2026-07-17", "2026-07-24"]);
  });

  test("no draw on Fridays before the hire date", () => {
    expect(scheduledDraws(plan, "2026-05", "2026-05-13").map((w) => w.date)).toEqual(["2026-05-15", "2026-05-22", "2026-05-29"]);
  });
});

describe("monthSummary", () => {
  const deals = [
    ...Array.from({ length: 10 }, () => deal("new", 3000)),
    ...Array.from({ length: 3 }, () => deal("used", 2500)),
  ];
  const base = { month: "2026-06", hireDate: HIRE, deals, acquisitionCount: 2, spiffCents: [100_00, 50_00], dpb: NO_DPB, drawOverrideCents: null };

  test("adds commission, volume, acquisitions and spiffs, then subtracts draws", () => {
    const s = monthSummary(base);
    expect(s.units).toEqual({ new: 10, used: 3, total: 13 });
    expect(s.commissionCents).toBe(10 * 480_00 + 3 * 450_00);
    expect(s.volume.bonusCents).toBe(500_00);
    expect(s.volume.next).toEqual({ units: 16, bonusCents: 500_00, unitsToGo: 3 });
    expect(s.acquisitions.bonusCents).toBe(400_00);
    expect(s.spiffsCents).toBe(150_00);
    expect(s.earningsCents).toBe(7200_00);
    expect(s.draws.totalCents).toBe(2000_00); // 4 Fridays in June 2026
    expect(s.checkCents).toBe(5200_00);
    expect(s.totalIncomeCents).toBe(7200_00);
    expect(s.payDate).toBe("2026-07-10");
  });

  test("DPB raises every new deal in the month", () => {
    const s = monthSummary({ ...base, dpb: { qualified: true, perCarCents: 800_00 } });
    expect(s.commissionCents).toBe(10 * 608_00 + 3 * 450_00);
    expect(s.dpb.addedCents).toBe(8000_00);
  });

  test("draw override replaces the scheduled draws", () => {
    const s = monthSummary({ ...base, drawOverrideCents: 1500_00 });
    expect(s.draws.scheduledCents).toBe(2000_00);
    expect(s.checkCents).toBe(7200_00 - 1500_00);
  });

  test("the draw is a guarantee: a slow month never pays less than the draws", () => {
    const s = monthSummary({ ...base, deals: [], acquisitionCount: 0, spiffCents: [] });
    expect(s.earningsCents).toBe(0);
    expect(s.checkCents).toBe(0);
    expect(s.totalIncomeCents).toBe(2000_00);
  });

  test("December pays out in January of the next year", () => {
    expect(monthSummary({ ...base, month: "2026-12" }).payDate).toBe("2027-01-10");
  });
});

describe("parseDollars", () => {
  test.each([
    ["1,234.56", 123456],
    ["$3000", 300000],
    ["-300", -30000],
    ["$-300.5", -30050],
    ["12.345", null],
    ["abc", null],
    ["", null],
  ])("%p -> %p", (input, cents) => {
    expect(parseDollars(input)).toBe(cents);
  });
});
