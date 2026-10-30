import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { dealRatePct, formatCents } from "../../shared/commission.ts";
import { addDays, fullYearsBetween, today } from "../../shared/dates.ts";
import { planForDate } from "../../shared/payplan.ts";
import { api, type Me } from "../api.ts";
import { ErrorText, Field, formatDate } from "../components/common.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Input } from "../components/ui/input.tsx";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group.tsx";
import { useUser } from "../hooks.ts";
import { setThemePreference, useTheme, type ThemePreference } from "../theme.ts";

const longDate = { month: "long", day: "numeric", year: "numeric" } as const;

function anniversary(hireDate: string, years: number): string {
  return `${Number(hireDate.slice(0, 4)) + years}${hireDate.slice(4)}`;
}

export function Profile() {
  const user = useUser();
  const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const [hireDate, setHireDate] = useState(user.hireDate);
  const save = useMutation({
    mutationFn: api.updateProfile,
    onSuccess: ({ user }) => {
      qc.setQueryData<Me | null>(["me"], (me) => me && { ...me, user });
      // Tenure and draws depend on the hire date, so every month's numbers may have moved.
      qc.invalidateQueries({ queryKey: ["month"] });
      toast.success("Profile saved");
    },
  });

  const now = today();
  const plan = planForDate(now);
  const years = fullYearsBetween(user.hireDate, now);
  const nextStep = plan.tenureSteps.find((s) => s.afterYears > years);
  const trainingEnds = addDays(user.hireDate, plan.draw.trainingDays);
  const dirty = name.trim() !== user.name || hireDate !== user.hireDate;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ name, hireDate });
  }

  return (
    <div className="mx-auto grid max-w-4xl items-start gap-5 sm:gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your profile</CardTitle>
          <CardDescription>Your hire date sets your tenure rate and training draw.</CardDescription>
        </CardHeader>
        <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={user.email} disabled />
          </Field>
          <Field label="Hire date">
            <Input type="date" required max={now} value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
          </Field>
          <ErrorText error={save.error} />
          <Button type="submit" disabled={!dirty || save.isPending} className="w-full">
            {save.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        </form>
        </CardContent>
      </Card>

      <div className="grid gap-5 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your pay plan today</CardTitle>
          </CardHeader>
          <CardContent>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Commission rate</dt>
              <dd className="mt-0.5 text-base font-semibold">
                {dealRatePct(plan, "new", user.hireDate, now)}% new, {dealRatePct(plan, "used", user.hireDate, now)}% pre-owned
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tenure</dt>
              <dd className="mt-0.5">
                {years} {years === 1 ? "year" : "years"}
                {nextStep && (
                  <span className="block text-muted-foreground">
                    +{nextStep.addPct}% on {formatDate(anniversary(user.hireDate, nextStep.afterYears), longDate)}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Weekly draw</dt>
              <dd className="mt-0.5">
                {now < trainingEnds
                  ? `${formatCents(plan.draw.trainingWeeklyCents, { whole: true })} training draw until ${formatDate(trainingEnds, longDate)}, then ${formatCents(plan.draw.weeklyCents, { whole: true })}`
                  : `${formatCents(plan.draw.weeklyCents, { whole: true })} every Friday`}
                <span className="block text-muted-foreground">
                  Up to {plan.draw.maxWeeksPerMonth} Fridays a month, so at most{" "}
                  {formatCents(plan.draw.maxWeeksPerMonth * (now < trainingEnds ? plan.draw.trainingWeeklyCents : plan.draw.weeklyCents), { whole: true })}
                </span>
              </dd>
            </div>
            <div className="border-t pt-3 text-xs text-muted-foreground">
              {plan.name}, effective {formatDate(plan.effectiveFrom, longDate)}
            </div>
          </dl>
          </CardContent>
        </Card>
        <Appearance />
      </div>
    </div>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function Appearance() {
  const { preference } = useTheme();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Appearance</CardTitle>
        <CardDescription>System follows your phone or computer's light and dark setting. Saved on this device.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Single choice; ignore the empty value Radix sends when the active item is pressed again. */}
        <ToggleGroup type="single" variant="outline" value={preference} onValueChange={(v) => v && setThemePreference(v as ThemePreference)} className="w-full" aria-label="Theme">
          {THEME_OPTIONS.map((o) => (
            <ToggleGroupItem key={o.value} value={o.value} className="flex-1">
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
  );
}
