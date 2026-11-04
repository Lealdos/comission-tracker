import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { dealCommission, formatCents, parseDollars, type DealLine, type DpbSetting } from "../../shared/commission.ts";
import { planForDate, type VehicleType } from "../../shared/payplan.ts";
import { api, type Acquisition, type Deal } from "../api.ts";
import { useMonthMutation } from "../hooks.ts";
import { ErrorText, Field, MoneyInput, NativeSelect, PayPreview, PercentInput, SOURCE_LABEL, parseSplitPct } from "./common.tsx";
import { Button } from "./ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";
import { Checkbox } from "./ui/checkbox.tsx";
import { Input } from "./ui/input.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs.tsx";

type Kind = VehicleType | "bought";

/** The main working card: tabs for a sale (new or pre-owned) or a car bought from a customer, then that form. Saved deals are edited in their dialog. */
export function LogPanel({
  defaultDate,
  hireDate,
  dpb,
  acquisitionBonusCents,
  className = "",
}: {
  defaultDate: string;
  hireDate: string;
  dpb: DpbSetting;
  acquisitionBonusCents: number;
  className?: string;
}) {
  // Survives saves, so a batch of the same kind needs no re-picking; a new key (month) starts over.
  const [kind, setKind] = useState<Kind>("new");
  const title = kind === "bought" ? "Log a car bought" : "Log a deal";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      {/* Fields lay out by the card's width, not the screen's: narrow in the desktop sidebar, roomy on a tablet. */}
      <CardContent className="@container">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)} className="gap-5">
          <TabsList className="w-full">
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="used">Pre-owned</TabsTrigger>
            <TabsTrigger value="bought">Bought</TabsTrigger>
          </TabsList>
          {/* One panel whose value follows the tab, so switching New and Pre-owned keeps what's typed. */}
          <TabsContent value={kind}>
            {kind === "bought" ? (
              <CarBoughtForm defaultDate={defaultDate} bonusCents={acquisitionBonusCents} />
            ) : (
              <DealForm vehicleType={kind} defaultDate={defaultDate} hireDate={hireDate} dpb={dpb} editing={null} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/** Edits a saved deal inside its dialog: the logging form, with New and Pre-owned as tabs (a sale can't become a car bought). */
export function DealEditor({ deal, hireDate, dpb, onDone }: { deal: Deal; hireDate: string; dpb: DpbSetting; onDone: () => void }) {
  const [kind, setKind] = useState<VehicleType>(deal.vehicleType);
  return (
    <div className="@container">
      <Tabs value={kind} onValueChange={(v) => setKind(v as VehicleType)} className="gap-5">
        <TabsList className="w-full">
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="used">Pre-owned</TabsTrigger>
        </TabsList>
        {/* One panel whose value follows the tab, so switching keeps what's typed. */}
        <TabsContent value={kind}>
          <DealForm vehicleType={kind} defaultDate={deal.soldOn} hireDate={hireDate} dpb={dpb} editing={deal} onDone={onDone} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Draft = {
  soldOn: string;
  gross: string;
  customerName: string;
  vehicle: string;
  stockNumber: string;
  affiliateStore: boolean;
  affiliateStoreName: string;
  split: boolean;
  splitWith: string;
  /** The other salesperson's share, as typed. */
  splitPct: string;
  splitCountsForVolume: boolean;
  notes: string;
};

const SPLIT_DEFAULTS = { split: false, splitWith: "", splitPct: "50", splitCountsForVolume: true };

function blankDraft(soldOn: string): Draft {
  return { soldOn, gross: "", customerName: "", vehicle: "", stockNumber: "", affiliateStore: false, affiliateStoreName: "", ...SPLIT_DEFAULTS, notes: "" };
}

function draftFromDeal(d: Deal): Draft {
  return {
    soldOn: d.soldOn,
    gross: (d.grossCents / 100).toFixed(2),
    customerName: d.customerName,
    vehicle: d.vehicle,
    stockNumber: d.stockNumber,
    affiliateStore: d.affiliateStore,
    affiliateStoreName: d.affiliateStoreName,
    ...(d.splitPct === null ? SPLIT_DEFAULTS : { split: true, splitWith: d.splitWith, splitPct: String(d.splitPct), splitCountsForVolume: d.splitCountsForVolume }),
    notes: d.notes,
  };
}

/** Logs a new deal (`editing` null) or saves changes to one; `onDone` runs after a save and on Cancel. */
function DealForm({ vehicleType, defaultDate, hireDate, dpb, editing, onDone }: { vehicleType: VehicleType; defaultDate: string; hireDate: string; dpb: DpbSetting; editing: Deal | null; onDone?: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => (editing ? draftFromDeal(editing) : blankDraft(defaultDate)));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = useMonthMutation((body: Parameters<typeof api.createDeal>[0]) => (editing ? api.updateDeal(editing.id, body) : api.createDeal(body)));

  const grossCents = parseDollars(draft.gross);
  const splitPct = draft.split ? parseSplitPct(draft.splitPct) : null;
  const preview =
    grossCents === null || !draft.soldOn
      ? null
      : dealCommission(
          planForDate(draft.soldOn),
          {
            id: 0,
            soldOn: draft.soldOn,
            vehicleType,
            grossCents,
            splitPct,
            splitCountsForVolume: draft.splitCountsForVolume,
          },
          hireDate,
          dpb,
        );

  const invalid = grossCents === null || (draft.split && splitPct === null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (invalid) return;
    save.mutate(
      {
        soldOn: draft.soldOn,
        vehicleType,
        grossCents: grossCents!,
        customerName: draft.customerName,
        vehicle: draft.vehicle,
        stockNumber: draft.stockNumber,
        affiliateStore: draft.affiliateStore,
        affiliateStoreName: draft.affiliateStore ? draft.affiliateStoreName : "",
        splitPct,
        splitWith: draft.split ? draft.splitWith : "",
        splitCountsForVolume: draft.split ? draft.splitCountsForVolume : true,
        notes: draft.notes,
      },
      {
        onSuccess: () => {
          toast.success(editing ? "Deal updated" : "Deal added", {
            description: `${draft.vehicle.trim()} for ${draft.customerName.trim()}${preview ? ` pays ${formatCents(preview.commissionCents)}` : ""}`,
          });
          // Keep the date (LogPanel keeps the type): deals usually get entered in batches from the same day.
          setDraft(blankDraft(draft.soldOn));
          onDone?.();
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-6 gap-x-3 gap-y-4">
      <Field label="Customer" className="col-span-6 @xl:col-span-3">
        <Input required autoComplete="off" value={draft.customerName} maxLength={200} onChange={(e) => set("customerName", e.target.value)} />
      </Field>
      <Field label="Vehicle" className="col-span-4 @xl:col-span-2">
        <Input required autoComplete="off" placeholder="e.g. 2026 Tucson SEL" value={draft.vehicle} maxLength={200} onChange={(e) => set("vehicle", e.target.value)} />
      </Field>
      <Field label="Stock #" className="col-span-2 @xl:col-span-1">
        <Input autoComplete="off" placeholder="Optional" value={draft.stockNumber} maxLength={200} onChange={(e) => set("stockNumber", e.target.value)} />
      </Field>

      <Field label="Sold on" className="col-span-3">
        <Input type="date" required value={draft.soldOn} onChange={(e) => set("soldOn", e.target.value)} />
      </Field>
      <Field label="Gross profit" className="col-span-3" hint="As reported, after the $500 management fee">
        <MoneyInput required placeholder="0.00" value={draft.gross} onChange={(e) => set("gross", e.target.value)} />
      </Field>

      <label className="col-span-6 flex items-start gap-3 text-sm">
        <Checkbox className="mt-0.5" checked={draft.affiliateStore} onCheckedChange={(v) => set("affiliateStore", v === true)} />
        <span>
          Sold at an affiliated Germain store
          <span className="block text-xs text-muted-foreground">Paid on your plan and counted toward your volume, like any other deal.</span>
        </span>
      </label>
      {draft.affiliateStore && (
        <Field label="Which store" className="col-span-6 @xl:col-span-3">
          <Input required autoComplete="off" placeholder="Store name" value={draft.affiliateStoreName} maxLength={200} onChange={(e) => set("affiliateStoreName", e.target.value)} />
        </Field>
      )}

      <label className="col-span-6 flex items-start gap-3 text-sm">
        <Checkbox className="mt-0.5" checked={draft.split} onCheckedChange={(v) => set("split", v === true)} />
        <span>
          Split with another salesperson
          <span className="block text-xs text-muted-foreground">Their share comes off this deal's commission.</span>
        </span>
      </label>
      {draft.split && (
        <>
          <Field label="Split with" className="col-span-4">
            <Input required autoComplete="off" placeholder="Salesperson's name" value={draft.splitWith} maxLength={200} onChange={(e) => set("splitWith", e.target.value)} />
          </Field>
          <Field label="Their share" className="col-span-2">
            <PercentInput required placeholder="50" maxLength={3} value={draft.splitPct} onChange={(e) => set("splitPct", e.target.value)} aria-invalid={splitPct === null || undefined} />
          </Field>
          {splitPct === null && <p className="col-span-6 -mt-2 text-xs text-destructive">Enter a whole percent from 1 to 99.</p>}
          <label className="col-span-6 flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5" checked={draft.splitCountsForVolume} onCheckedChange={(v) => set("splitCountsForVolume", v === true)} />
            <span>
              Count this car toward my volume bonus
              <span className="block text-xs text-muted-foreground">Turn off if the unit goes to the other salesperson.</span>
            </span>
          </label>
        </>
      )}

      <Field label="Notes" className="col-span-6">
        <Input placeholder="Optional" value={draft.notes} maxLength={2000} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      <div className="col-span-6">
        <DealPreview line={preview} splitWith={draft.splitWith.trim()} />
      </div>

      <div className="col-span-6 grid gap-3">
        <ErrorText error={save.error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={invalid || save.isPending} className="flex-1">
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add deal"}
          </Button>
          {editing && (
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function DealPreview({ line, splitWith }: { line: DealLine | null; splitWith: string }) {
  if (!line) return <div className="rounded-lg border border-dashed px-3.5 py-3 text-sm text-muted-foreground">Enter the gross to see what this deal pays.</div>;
  return <PayPreview label="This deal pays" cents={line.commissionCents} detail={dealMath(line, splitWith)} />;
}

/** How a deal's pay adds up, in one line: gross (plus DPB) times the rate, the minimum, then any split. */
export function dealMath(line: DealLine, splitWith: string): string {
  const gross = line.dpbCents ? `(${formatCents(line.grossCents)} + ${formatCents(line.dpbCents, { whole: true })} DPB)` : formatCents(line.grossCents);
  let math = `${gross} × ${line.ratePct}% = ${formatCents(line.rawCommissionCents)}`;
  if (line.minimumApplied) math += `, so the ${formatCents(line.fullCommissionCents, { whole: true })} minimum applies`;
  if (line.splitPct !== null) {
    math += `, minus ${splitWith ? `${splitWith}'s` : "their"} ${line.splitPct}% (${formatCents(line.splitCents)})`;
    if (!line.countsForVolume) math += ". Not counted toward your volume";
  }
  return math;
}

/** Logs a car bought from a customer: the log card's "Bought" tab. */
function CarBoughtForm({ defaultDate, bonusCents }: { defaultDate: string; bonusCents: number }) {
  const [acquiredOn, setAcquiredOn] = useState(defaultDate);
  const [source, setSource] = useState<Acquisition["source"]>("service_drive");
  const [customerName, setCustomerName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const add = useMonthMutation(api.createAcquisition);

  function submit(e: FormEvent) {
    e.preventDefault();
    add.mutate(
      { acquiredOn, source, customerName, vehicle },
      {
        onSuccess: () => {
          toast.success("Car bought added", { description: `${vehicle.trim()} from ${customerName.trim()}, +${formatCents(bonusCents, { whole: true })}` });
          // Keep date and source, like the deal form keeps date and type.
          setCustomerName("");
          setVehicle("");
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-6 gap-x-3 gap-y-4">
      <Field label="Customer" className="col-span-6 @xl:col-span-3">
        <Input required autoComplete="off" value={customerName} maxLength={200} onChange={(e) => setCustomerName(e.target.value)} />
      </Field>
      <Field label="Vehicle" className="col-span-6 @xl:col-span-3">
        <Input required autoComplete="off" placeholder="e.g. 2019 Camry" value={vehicle} maxLength={200} onChange={(e) => setVehicle(e.target.value)} />
      </Field>
      <Field label="Bought on" className="col-span-3">
        <Input type="date" required value={acquiredOn} onChange={(e) => setAcquiredOn(e.target.value)} />
      </Field>
      <Field label="Customer from" className="col-span-3">
        <NativeSelect value={source} onChange={(e) => setSource(e.target.value as Acquisition["source"])}>
          {Object.entries(SOURCE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="col-span-6">
        <PayPreview label="This car pays" cents={bonusCents} detail="Flat bonus per vehicle, added to this month's earnings" />
      </div>

      <div className="col-span-6 grid gap-3">
        <ErrorText error={add.error} />
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? "Saving…" : "Add car bought"}
        </Button>
      </div>
    </form>
  );
}
