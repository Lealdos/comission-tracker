import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { dealCommission, formatCents, parseDollars, type DealLine, type DpbSetting, type SplitUnit } from "../../shared/commission.ts";
import { planForDate, type VehicleType } from "../../shared/payplan.ts";
import { PHONE_PATTERN } from "../../shared/phone.ts";
import { api, type Acquisition, type Deal } from "../api.ts";
import { SOURCE_LABEL, dealMath, parseSplitPct, parseUnitBonus } from "../format.ts";
import { useMonthMutation } from "../hooks.ts";
import { ErrorText, Field, MoneyInput, NativeSelect, PayPreview, PercentInput, SignedMoneyInput } from "./common.tsx";
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
  customerPhone: string;
  vehicle: string;
  stockNumber: string;
  affiliateStore: boolean;
  affiliateStoreName: string;
  split: boolean;
  splitWith: string;
  /** The other salesperson's share, as typed. */
  splitPct: string;
  /** Whose volume count the car adds to: all mine, half a unit, or the other salesperson's. */
  splitUnit: SplitUnit;
  unitBonus: boolean;
  /** The unit bonus, as typed. */
  unitBonusAmount: string;
  /** On a split deal, whether the unit bonus was for both salespeople. */
  unitBonusShared: boolean;
  notes: string;
};

const SPLIT_DEFAULTS = { split: false, splitWith: "", splitPct: "50", splitUnit: "mine", unitBonusShared: false } satisfies Partial<Draft>;

function blankDraft(soldOn: string): Draft {
  return { soldOn, gross: "", customerName: "", customerPhone: "", vehicle: "", stockNumber: "", affiliateStore: false, affiliateStoreName: "", ...SPLIT_DEFAULTS, unitBonus: false, unitBonusAmount: "", notes: "" };
}


function draftFromDeal(d: Deal): Draft {
  return {
    soldOn: d.soldOn,
    gross: (d.grossCents / 100).toFixed(2),
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    vehicle: d.vehicle,
    stockNumber: d.stockNumber,
    affiliateStore: d.affiliateStore,
    affiliateStoreName: d.affiliateStoreName,
    ...(d.splitPct === null ? SPLIT_DEFAULTS : { split: true, splitWith: d.splitWith, splitPct: String(d.splitPct), splitUnit: d.splitUnit, unitBonusShared: d.unitBonusShared }),
    unitBonus: d.unitBonusCents > 0,
    unitBonusAmount: d.unitBonusCents > 0 ? (d.unitBonusCents / 100).toFixed(2) : "",
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
  const unitBonusCents = draft.unitBonus ? parseUnitBonus(draft.unitBonusAmount) : 0;
  // Only asked when the deal has both a split and a unit bonus.
  const unitBonusShared = draft.split && draft.unitBonus && draft.unitBonusShared;
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
            splitUnit: draft.splitUnit,
            unitBonusCents: unitBonusCents ?? 0,
            unitBonusShared,
          },
          hireDate,
          dpb,
        );

  const invalid = grossCents === null || (draft.split && splitPct === null) || unitBonusCents === null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (invalid) return;
    save.mutate(
      {
        soldOn: draft.soldOn,
        vehicleType,
        grossCents: grossCents!,
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        vehicle: draft.vehicle,
        stockNumber: draft.stockNumber,
        affiliateStore: draft.affiliateStore,
        affiliateStoreName: draft.affiliateStore ? draft.affiliateStoreName : "",
        splitPct,
        splitWith: draft.split ? draft.splitWith : "",
        splitUnit: draft.split ? draft.splitUnit : "mine",
        unitBonusCents: unitBonusCents!,
        unitBonusShared,
        notes: draft.notes,
      },
      {
        onSuccess: () => {
          toast.success(editing ? "Deal updated" : "Deal added", {
            description: `${draft.vehicle.trim()} for ${draft.customerName.trim()}${preview ? ` pays ${formatCents(preview.payCents)}` : ""}`,
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
      {/* The buyer's number, so autofill stays off; type="tel" brings up the phone keypad. */}
      <Field label="Phone" className="col-span-6 @xl:col-span-3">
        <Input
          type="tel"
          autoComplete="off"
          placeholder="Optional"
          value={draft.customerPhone}
          maxLength={30}
          pattern={PHONE_PATTERN}
          title="A phone number with 7 to 15 digits, like 801 555 0142"
          onChange={(e) => set("customerPhone", e.target.value)}
        />
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
        <SignedMoneyInput required placeholder="0.00" value={draft.gross} onValueChange={(v) => set("gross", v)} />
      </Field>

      <UnitBonusFields
        checked={draft.unitBonus}
        onCheckedChange={(v) => set("unitBonus", v)}
        amount={draft.unitBonusAmount}
        onAmountChange={(v) => set("unitBonusAmount", v)}
        hint="Added on top of the commission; it isn't run through your rate."
      />

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
          <Field label="This car counts toward" className="col-span-6" hint="Units for the volume bonus.">
            <NativeSelect value={draft.splitUnit} onChange={(e) => set("splitUnit", e.target.value as SplitUnit)}>
              <option value="mine">My volume: a whole unit</option>
              <option value="half">My volume: half a unit</option>
              <option value="theirs">{draft.splitWith.trim() ? `${draft.splitWith.trim()}'s` : "The other salesperson's"} volume, not mine</option>
            </NativeSelect>
          </Field>
          {draft.unitBonus && (
            <label className="col-span-6 flex items-start gap-3 text-sm">
              <Checkbox className="mt-0.5" checked={draft.unitBonusShared} onCheckedChange={(v) => set("unitBonusShared", v === true)} />
              <span>
                The unit bonus is for both of us
                <span className="block text-xs text-muted-foreground">On: their share comes off the bonus too. Off: the whole bonus is yours.</span>
              </span>
            </label>
          )}
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
  return <PayPreview label="This deal pays" cents={line.payCents} detail={dealMath(line, splitWith)} />;
}

/**
 * The optional one-off bonus for one particular car, sold or bought: a checkbox that reveals the amount.
 * It's entered as what the salesperson gets, so it isn't run through the rate or split.
 */
function UnitBonusFields({
  checked,
  onCheckedChange,
  amount,
  onAmountChange,
  hint,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  hint: string;
}) {
  // An empty field just disables saving; only something typed that isn't an amount gets the error.
  const unreadable = amount !== "" && parseUnitBonus(amount) === null;
  return (
    <>
      <label className="col-span-6 flex items-start gap-3 text-sm">
        <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
        <span>
          This car has a unit bonus
          <span className="block text-xs text-muted-foreground">A one-off bonus on this car, paid on top of what the plan pays.</span>
        </span>
      </label>
      {checked && (
        <>
          <Field label="Unit bonus" className="col-span-6 @xl:col-span-3" hint={hint}>
            <MoneyInput required placeholder="0.00" value={amount} onChange={(e) => onAmountChange(e.target.value)} aria-invalid={unreadable || undefined} />
          </Field>
          {unreadable && <p className="col-span-6 -mt-2 text-xs text-destructive">Enter an amount in dollars, like 250 or 250.00.</p>}
        </>
      )}
    </>
  );
}

/** Logs a car bought from a customer: the log card's "Bought" tab. */
function CarBoughtForm({ defaultDate, bonusCents }: { defaultDate: string; bonusCents: number }) {
  const [acquiredOn, setAcquiredOn] = useState(defaultDate);
  const [source, setSource] = useState<Acquisition["source"]>("service_drive");
  const [customerName, setCustomerName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [unitBonus, setUnitBonus] = useState(false);
  const [unitBonusAmount, setUnitBonusAmount] = useState("");
  const add = useMonthMutation(api.createAcquisition);
  const unitBonusCents = unitBonus ? parseUnitBonus(unitBonusAmount) : 0;
  const totalCents = bonusCents + (unitBonusCents ?? 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (unitBonusCents === null) return;
    add.mutate(
      { acquiredOn, source, customerName, vehicle, unitBonusCents },
      {
        onSuccess: () => {
          toast.success("Car bought added", { description: `${vehicle.trim()} from ${customerName.trim()}, +${formatCents(totalCents)}` });
          // Keep date and source, like the deal form keeps date and type.
          setCustomerName("");
          setVehicle("");
          setUnitBonus(false);
          setUnitBonusAmount("");
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

      <UnitBonusFields checked={unitBonus} onCheckedChange={setUnitBonus} amount={unitBonusAmount} onAmountChange={setUnitBonusAmount} hint="What you get, on top of the flat bonus." />

      <div className="col-span-6">
        <PayPreview
          label="This car pays"
          cents={totalCents}
          detail={
            unitBonusCents
              ? `${formatCents(bonusCents, { whole: true })} flat bonus plus ${formatCents(unitBonusCents)} unit bonus, added to this month's earnings`
              : "Flat bonus per vehicle, added to this month's earnings"
          }
        />
      </div>

      <div className="col-span-6 grid gap-3">
        <ErrorText error={add.error} />
        <Button type="submit" disabled={unitBonusCents === null || add.isPending}>
          {add.isPending ? "Saving…" : "Add car bought"}
        </Button>
      </div>
    </form>
  );
}
