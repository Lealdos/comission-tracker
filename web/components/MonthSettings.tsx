import { useState } from "react";
import { toast } from "sonner";
import { formatCents, parseDollars } from "../../shared/commission.ts";
import type { MonthSettingsBody } from "../../shared/schemas.ts";
import { api } from "../api.ts";
import { useMonthMutation } from "../hooks.ts";
import { ErrorText, Field, MoneyInput } from "./common.tsx";
import { Button } from "./ui/button.tsx";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card.tsx";
import { Checkbox } from "./ui/checkbox.tsx";

const toInput = (cents: number | null) => (cents === null || cents === 0 ? "" : (cents / 100).toFixed(2));

/** Dealer Performance Bonus and actual draws: the two month-level inputs the pay plan depends on. */
export function MonthSettings({ month, settings, newDeals, scheduledDrawCents, drawWeeks }: { month: string; settings: MonthSettingsBody; newDeals: number; scheduledDrawCents: number; drawWeeks: number }) {
  const [qualified, setQualified] = useState(settings.dpbQualified);
  const [perCar, setPerCar] = useState(toInput(settings.dpbPerCarCents));
  const [drawOverride, setDrawOverride] = useState(toInput(settings.drawOverrideCents));
  const save = useMonthMutation((body: MonthSettingsBody) => api.saveSettings(month, body));

  const perCarCents = perCar.trim() === "" ? 0 : parseDollars(perCar);
  const drawCents = drawOverride.trim() === "" ? null : parseDollars(drawOverride);
  const invalid = perCarCents === null || perCarCents < 0 || (drawCents !== null && drawCents < 0) || (drawOverride.trim() !== "" && drawCents === null);
  const dirty = qualified !== settings.dpbQualified || perCarCents !== settings.dpbPerCarCents || drawCents !== settings.drawOverrideCents;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">This month's settings</CardTitle>
        <CardDescription>Dealer Performance Bonus and the draws you were actually paid.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5" checked={qualified} onCheckedChange={(v) => setQualified(v === true)} />
            <span>
              Met CSI &amp; certification standards
              <span className="block text-xs text-muted-foreground">Adds the Dealer Performance Bonus to the gross of every new vehicle.</span>
            </span>
          </label>
          {qualified && (
            <Field
              label="DPB per car"
              hint={perCarCents ? `Adds ${formatCents(perCarCents * newDeals, { whole: true })} to ${newDeals} new ${newDeals === 1 ? "deal" : "deals"}` : "e.g. $80,000 over 100 units = $800"}
            >
              <MoneyInput placeholder="800.00" value={perCar} onChange={(e) => setPerCar(e.target.value)} />
            </Field>
          )}
        </div>

        <Field label="Draws actually paid" hint={`Leave blank to use the schedule: ${drawWeeks} Fridays = ${formatCents(scheduledDrawCents, { whole: true })}`}>
          <MoneyInput placeholder={(scheduledDrawCents / 100).toFixed(2)} value={drawOverride} onChange={(e) => setDrawOverride(e.target.value)} />
        </Field>
      </CardContent>
      <CardFooter className="flex-wrap gap-3">
        <Button
          className="max-sm:w-full"
          disabled={!dirty || invalid || save.isPending}
          onClick={() => save.mutate({ dpbQualified: qualified, dpbPerCarCents: perCarCents ?? 0, drawOverrideCents: drawCents }, { onSuccess: () => toast.success("Month settings saved") })}
        >
          {save.isPending ? "Saving…" : dirty ? "Save settings" : "Saved"}
        </Button>
        <ErrorText error={save.error} />
      </CardFooter>
    </Card>
  );
}
