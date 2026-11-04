import { Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { formatCents, type DealLine, type DpbSetting } from "../../shared/commission.ts";
import { api, type Deal } from "../api.ts";
import { useMonthMutation } from "../hooks.ts";
import { ConfirmDelete, ErrorText, Money, PayPreview, formatDate, tone } from "./common.tsx";
import { DealEditor, dealMath } from "./DealForm.tsx";
import { Badge } from "./ui/badge.tsx";
import { Button } from "./ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog.tsx";

const longDate = { month: "long", day: "numeric", year: "numeric" } as const;

/**
 * A saved deal opened from the deals list: everything logged about it, notes included, and what it pays.
 * From here it's edited (the logging form, in place) or deleted. `deal` null closes the dialog.
 */
export function DealDialog({
  deal,
  line,
  editing,
  onEditingChange,
  onClose,
  hireDate,
  dpb,
}: {
  deal: Deal | null;
  line: DealLine | null;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onClose: () => void;
  hireDate: string;
  dpb: DpbSetting;
}) {
  // Keep showing the last deal while the dialog animates closed, after the selection (or, once deleted, the deal) is gone.
  const [last, setLast] = useState({ deal, line, editing });
  if (deal && (deal !== last.deal || line !== last.line || editing !== last.editing)) setLast({ deal, line, editing });
  const shown = deal ? { deal, line, editing } : last;

  return (
    <Dialog open={deal !== null} onOpenChange={(open) => !open && onClose()}>
      {shown.deal && (
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          {shown.editing ? (
            <>
              <DialogHeader className="pr-8 text-left">
                <DialogTitle>Edit deal</DialogTitle>
                <DialogDescription>{dealHeading(shown.deal)}</DialogDescription>
              </DialogHeader>
              {/* A fresh form for each deal, so it starts from what's saved. */}
              <DealEditor key={shown.deal.id} deal={shown.deal} hireDate={hireDate} dpb={dpb} onDone={() => onEditingChange(false)} />
            </>
          ) : (
            <DealDetails deal={shown.deal} line={shown.line} onEdit={() => onEditingChange(true)} onDeleted={onClose} />
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

function dealHeading(deal: Deal): string {
  return [deal.customerName, formatDate(deal.soldOn, longDate)].filter(Boolean).join(", ");
}

function DealDetails({ deal, line, onEdit, onDeleted }: { deal: Deal; line: DealLine | null; onEdit: () => void; onDeleted: () => void }) {
  const remove = useMonthMutation((id: number) => api.deleteDeal(id));
  const missing = <span className="text-warning">Not entered</span>;

  return (
    <>
      <DialogHeader className="pr-8 text-left">
        <DialogTitle className="leading-snug">{deal.vehicle || "Vehicle not entered"}</DialogTitle>
        <DialogDescription>{dealHeading(deal)}</DialogDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge className={deal.vehicleType === "new" ? tone.positive : tone.neutral}>{deal.vehicleType === "new" ? "New" : "Pre-owned"}</Badge>
          {deal.affiliateStore && <Badge className={tone.neutral}>Affiliate</Badge>}
          {deal.splitPct !== null && <Badge className={tone.neutral}>Split</Badge>}
          {line?.minimumApplied && <Badge className={tone.warning}>Minimum</Badge>}
        </div>
      </DialogHeader>

      {line && <PayPreview label="This deal pays" cents={line.commissionCents} detail={dealMath(line, deal.splitWith)} />}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Item label="Customer">{deal.customerName || missing}</Item>
        <Item label="Sold on">{formatDate(deal.soldOn, longDate)}</Item>
        <Item label="Stock #">{deal.stockNumber || <span className="text-muted-foreground">None</span>}</Item>
        <Item label="Gross profit">
          <Money cents={deal.grossCents} />
          {!!line?.dpbCents && <span className="text-positive"> + {formatCents(line.dpbCents, { whole: true })} DPB</span>}
        </Item>
        {line && <Item label="Rate">{line.ratePct}%</Item>}
        {deal.affiliateStore && <Item label="Sold at">{deal.affiliateStoreName || missing}</Item>}
        {deal.splitPct !== null && (
          <Item label="Split" wide>
            {deal.splitPct}% to {deal.splitWith}
            {line && <span className="text-muted-foreground"> ({formatCents(line.splitCents)})</span>}
            <span className="block text-muted-foreground">{deal.splitCountsForVolume ? "Counts toward your volume" : "Not counted toward your volume"}</span>
          </Item>
        )}
        <Item label="Notes" wide>
          {deal.notes ? <span className="whitespace-pre-wrap">{deal.notes}</span> : <span className="text-muted-foreground">No notes</span>}
        </Item>
      </dl>

      <ErrorText error={remove.error} />
      <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
        <ConfirmDelete
          label="Delete"
          what={`deal from ${formatDate(deal.soldOn)}`}
          title="Delete this deal?"
          description={`${deal.vehicle || "This deal"}${deal.customerName ? ` sold to ${deal.customerName}` : ""} on ${formatDate(deal.soldOn, { month: "long", day: "numeric" })}.${line ? ` Its ${formatCents(line.commissionCents)} commission comes off this month.` : ""}`}
          confirmLabel="Delete deal"
          disabled={remove.isPending}
          onConfirm={() =>
            remove.mutate(deal.id, {
              onSuccess: () => {
                toast("Deal deleted");
                onDeleted();
              },
            })
          }
        />
        <Button onClick={onEdit}>
          <Pencil />
          Edit deal
        </Button>
      </DialogFooter>
    </>
  );
}

function Item({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 tabular-nums">{children}</dd>
    </div>
  );
}
