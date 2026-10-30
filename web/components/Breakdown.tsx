import type { ReactNode } from "react";
import { formatCents, type MonthSummary } from "../../shared/commission.ts";
import { Money, formatDate } from "./common.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";

function Row({ label, detail, cents, strong, negative }: { label: ReactNode; detail?: ReactNode; cents: number; strong?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${strong ? "font-semibold" : ""}`}>
      <div>
        <div>{label}</div>
        {detail && <div className="text-xs font-normal text-muted-foreground">{detail}</div>}
      </div>
      <span className="shrink-0">
        {negative ? "− " : ""}
        <Money cents={cents} />
      </span>
    </div>
  );
}

/** Line-by-line path from the month's activity to the commission check, so it can be compared with the dealership's sheet. */
export function Breakdown({ summary: s }: { summary: MonthSummary }) {
  const minimums = s.deals.filter((d) => d.minimumApplied).length;
  const commissionDetail = [`${s.units.total} ${s.units.total === 1 ? "deal" : "deals"}`, minimums && `${minimums} at the minimum`, s.dpb.addedCents && "includes DPB"].filter(Boolean).join(", ");
  const trainingWeek = s.draws.weeks.find((w) => w.training);
  const drawDetail = s.draws.overridden
    ? "Actual amount you entered"
    : [`${s.draws.weeks.length} ${s.draws.weeks.length === 1 ? "Friday" : "Fridays"}, up to ${s.draws.maxWeeks} a month`, trainingWeek && `includes ${formatCents(trainingWeek.cents, { whole: true })} training weeks`]
        .filter(Boolean)
        .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">How the check adds up</CardTitle>
      </CardHeader>
      <CardContent>
      <div className="divide-y text-sm">
        <div className="pb-1.5">
          <Row label="Commission" detail={commissionDetail} cents={s.commissionCents} />
          <Row label="Volume bonus" detail={`${s.units.total} units`} cents={s.volume.bonusCents} />
          <Row label="Cars bought" detail={`${s.acquisitions.count} × ${formatCents(s.acquisitions.perCarCents, { whole: true })}`} cents={s.acquisitions.bonusCents} />
          <Row label="Spiffs & incentives" cents={s.spiffsCents} />
        </div>
        <div className="py-1.5">
          <Row label="Earned this month" cents={s.earningsCents} strong />
          <Row label="Weekly draws already paid" detail={drawDetail} cents={s.draws.totalCents} negative />
        </div>
        <div className="pt-1.5">
          <Row label={`Check on ${formatDate(s.payDate, { month: "short", day: "numeric", year: "numeric" })}`} cents={s.checkCents} strong />
          {s.earningsCents < s.draws.totalCents && (
            <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
              Earnings are <Money cents={s.draws.totalCents - s.earningsCents} /> below your draws. The draw is a guarantee, so this month still pays <Money cents={s.totalIncomeCents} />.
            </p>
          )}
        </div>
      </div>
      </CardContent>
    </Card>
  );
}
