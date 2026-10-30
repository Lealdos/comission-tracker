import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { dealCommission, formatCents, parseDollars, type DpbSetting } from "../../shared/commission.ts";
import { planForDate, type VehicleType } from "../../shared/payplan.ts";
import { api, type Acquisition, type Deal } from "../api.ts";
import { useMonthMutation } from "../hooks.ts";
import { ConfirmDelete, ErrorText, Field, MoneyInput, NativeSelect, PayPreview, SOURCE_LABEL, formatDate } from "./common.tsx";
import { Button } from "./ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.tsx";
import { Checkbox } from "./ui/checkbox.tsx";
import { Input } from "./ui/input.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs.tsx";

type Kind = VehicleType | "bought";

/** The main working card: tabs for a sale (new or pre-owned) or a car bought from a customer, then that form. */
export function LogPanel({
  defaultDate,
  hireDate,
  dpb,
  acquisitionBonusCents,
  editing,
  onDone,
}: {
  defaultDate: string;
  hireDate: string;
  dpb: DpbSetting;
  acquisitionBonusCents: number;
  editing: Deal | null;
  onDone: () => void;
}) {
  // Survives saves, so a batch of the same kind needs no re-picking; a new key (month, edit) starts over.
  const [kind, setKind] = useState<Kind>(editing?.vehicleType ?? "new");
  const title = editing ? "Edit deal" : kind === "bought" ? "Log a car bought" : "Log a deal";

  return (
    <Card id="deal-form" className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      {/* Fields lay out by the card's width, not the screen's: narrow in the desktop sidebar, roomy on a tablet. */}
      <CardContent className="@container">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)} className="gap-5">
          <TabsList className="w-full">
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="used">Pre-owned</TabsTrigger>
            {/* A sale can't become a car bought, so editing one offers only the sale types. */}
            {!editing && <TabsTrigger value="bought">Bought</TabsTrigger>}
          </TabsList>
          {/* One panel whose value follows the tab, so switching New and Pre-owned keeps what's typed. */}
          <TabsContent value={kind}>
            {kind === "bought" ? (
              <CarBoughtForm defaultDate={defaultDate} bonusCents={acquisitionBonusCents} />
            ) : (
              <DealForm vehicleType={kind} defaultDate={defaultDate} hireDate={hireDate} dpb={dpb} editing={editing} onDone={onDone} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

type Draft = {
  soldOn: string;
  gross: string;
  customerName: string;
  vehicle: string;
  stockNumber: string;
  affiliateStore: boolean;
  affiliateCommission: string;
  notes: string;
};

function blankDraft(soldOn: string): Draft {
  return { soldOn, gross: "", customerName: "", vehicle: "", stockNumber: "", affiliateStore: false, affiliateCommission: "", notes: "" };
}

function draftFromDeal(d: Deal): Draft {
  return {
    soldOn: d.soldOn,
    gross: (d.grossCents / 100).toFixed(2),
    customerName: d.customerName,
    vehicle: d.vehicle,
    stockNumber: d.stockNumber,
    affiliateStore: d.affiliateStore,
    affiliateCommission: d.affiliateCommissionCents === null ? "" : (d.affiliateCommissionCents / 100).toFixed(2),
    notes: d.notes,
  };
}

function DealForm({ vehicleType, defaultDate, hireDate, dpb, editing, onDone }: { vehicleType: VehicleType; defaultDate: string; hireDate: string; dpb: DpbSetting; editing: Deal | null; onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => (editing ? draftFromDeal(editing) : blankDraft(defaultDate)));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const save = useMonthMutation((body: Parameters<typeof api.createDeal>[0]) => (editing ? api.updateDeal(editing.id, body) : api.createDeal(body)));
  const remove = useMonthMutation((id: number) => api.deleteDeal(id));

  const grossCents = parseDollars(draft.gross);
  const affiliateCents = draft.affiliateStore ? parseDollars(draft.affiliateCommission) : null;
  const preview =
    grossCents === null || !draft.soldOn
      ? null
      : dealCommission(planForDate(draft.soldOn), { id: 0, soldOn: draft.soldOn, vehicleType, grossCents, affiliateStore: draft.affiliateStore, affiliateCommissionCents: affiliateCents }, hireDate, dpb);

  const invalid = grossCents === null || (draft.affiliateStore && affiliateCents === null);

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
        affiliateCommissionCents: affiliateCents,
        notes: draft.notes,
      },
      {
        onSuccess: () => {
          toast.success(editing ? "Deal updated" : "Deal added", {
            description: `${draft.vehicle.trim()} for ${draft.customerName.trim()}${preview ? ` pays ${formatCents(preview.commissionCents)}` : ""}`,
          });
          // Keep the date (LogPanel keeps the type): deals usually get entered in batches from the same day.
          setDraft(blankDraft(draft.soldOn));
          onDone();
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
          <span className="block text-xs text-muted-foreground">Counts toward your volume bonus; paid on that store's plan.</span>
        </span>
      </label>
      {draft.affiliateStore && (
        <Field label="Commission from that store" className="col-span-6 @xl:col-span-3">
          <MoneyInput required placeholder="0.00" value={draft.affiliateCommission} onChange={(e) => set("affiliateCommission", e.target.value)} />
        </Field>
      )}

      <Field label="Notes" className="col-span-6">
        <Input placeholder="Optional" value={draft.notes} maxLength={2000} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      <div className="col-span-6">
        <DealPreview line={preview} />
      </div>

      <div className="col-span-6 grid gap-3">
        <ErrorText error={save.error ?? remove.error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={invalid || save.isPending} className="flex-1">
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add deal"}
          </Button>
          {editing && (
            <>
              <Button type="button" variant="outline" onClick={onDone}>
                Cancel
              </Button>
              <ConfirmDelete
                what={`deal from ${formatDate(editing.soldOn)}`}
                title="Delete this deal?"
                description={`${editing.vehicle || "This deal"}${editing.customerName ? ` sold to ${editing.customerName}` : ""} on ${formatDate(editing.soldOn, { month: "long", day: "numeric" })}. Its commission comes off this month.`}
                confirmLabel="Delete deal"
                disabled={remove.isPending}
                onConfirm={() =>
                  remove.mutate(editing.id, {
                    onSuccess: () => {
                      toast("Deal deleted");
                      onDone();
                    },
                  })
                }
              />
            </>
          )}
        </div>
      </div>
    </form>
  );
}

function DealPreview({ line }: { line: ReturnType<typeof dealCommission> | null }) {
  if (!line) return <div className="rounded-lg border border-dashed px-3.5 py-3 text-sm text-muted-foreground">Enter the gross to see what this deal pays.</div>;

  let math: string;
  if (line.affiliateStore) math = "Paid on the affiliated store's plan";
  else {
    const gross = line.dpbCents ? `(${formatCents(line.grossCents)} + ${formatCents(line.dpbCents, { whole: true })} DPB)` : formatCents(line.grossCents);
    math = `${gross} × ${line.ratePct}% = ${formatCents(line.rawCommissionCents)}`;
    if (line.minimumApplied) math += `, so the ${formatCents(line.commissionCents, { whole: true })} minimum applies`;
  }

  return <PayPreview label="This deal pays" cents={line.commissionCents} detail={math} />;
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
