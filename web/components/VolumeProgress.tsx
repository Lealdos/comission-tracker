import type { MonthSummary } from "../../shared/commission.ts";
import { Check } from "lucide-react";
import { Money } from "./common.tsx";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";

type Milestone = MonthSummary["volume"]["milestones"][number];

/** Groups consecutive milestones that pay the same amount, matching how the pay plan's table reads. */
function tiers(milestones: Milestone[]) {
  const out: { bonusCents: number; milestones: Milestone[] }[] = [];
  for (const m of milestones) {
    const last = out.at(-1);
    if (last && last.bonusCents === m.bonusCents) last.milestones.push(m);
    else out.push({ bonusCents: m.bonusCents, milestones: [m] });
  }
  return out;
}

export function VolumeProgress({ summary }: { summary: MonthSummary }) {
  const { units, volume } = summary;
  const uncounted = summary.deals.filter((d) => !d.countsForVolume).length;
  const top = volume.milestones.at(-1)!.units;
  const atMilestone = new Set(volume.milestones.map((m) => m.units));
  // One slot per unit up to the last milestone; milestone slots stand taller, like posts on the board.
  const columns = { gridTemplateColumns: `repeat(${top}, minmax(0, 1fr))` };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Volume bonus</CardTitle>
        <CardAction>
          <Money cents={volume.bonusCents} className="font-display text-xl font-semibold text-positive" />
        </CardAction>
      </CardHeader>
      <CardContent>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-4xl leading-none font-semibold tabular-nums">{units.total}</span>
        <span className="text-sm text-muted-foreground">
          {units.total === 1 ? "unit" : "units"}: {units.new} new, {units.used} pre-owned
          {uncounted > 0 && `, plus ${uncounted} split ${uncounted === 1 ? "deal" : "deals"} not counted`}
        </span>
      </p>

      <p className="mt-2 text-sm">
        {volume.next ? (
          <>
            <strong>{volume.next.unitsToGo}</strong> more {volume.next.unitsToGo === 1 ? "unit" : "units"} to unlock{" "}
            <strong className="text-positive">
              +<Money cents={volume.next.bonusCents} whole />
            </strong>{" "}
            at {volume.next.units}
          </>
        ) : (
          <>Every volume bonus earned this month.</>
        )}
      </p>

      <div className="mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={top} aria-valuenow={Math.min(units.total, top)} aria-label="Units sold toward volume bonuses">
        <div className="grid h-6 items-end gap-0.5" style={columns}>
          {Array.from({ length: top }, (_, i) => {
            const n = i + 1;
            const filled = n <= units.total;
            const milestone = atMilestone.has(n);
            return (
              <div
                key={n}
                className={`rounded-[3px] motion-safe:transition-colors motion-safe:duration-500 ${milestone ? "h-6" : "h-4"} ${filled ? "bg-primary" : milestone ? "bg-input" : "bg-border"}`}
              />
            );
          })}
        </div>
        <div className="mt-1.5 grid text-xs tabular-nums" style={columns}>
          {volume.milestones.map((m) => (
            <span key={m.units} className={`justify-self-center ${m.reached ? "font-semibold" : "text-muted-foreground"}`} style={{ gridColumn: m.units }}>
              {m.units}
            </span>
          ))}
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
        {tiers(volume.milestones).map((t) => (
          <li key={t.milestones[0]!.units}>
            <div className="font-medium">
              <Money cents={t.bonusCents} whole /> each at
            </div>
            <div className="flex flex-wrap gap-x-2 text-muted-foreground tabular-nums">
              {t.milestones.map((m) => (
                <span key={m.units} className={`inline-flex items-center gap-0.5 ${m.reached ? "font-semibold text-positive" : ""}`}>
                  {m.reached && <Check className="size-3.5" aria-label="reached" aria-hidden={false} role="img" />}
                  {m.units}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      </CardContent>
    </Card>
  );
}
