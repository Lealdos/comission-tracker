// App-level building blocks on top of the shadcn/ui primitives in ./ui/. Components only; shared helpers are in ../format.ts.

import { Trash2 } from "lucide-react";
import { useRef, type ComponentProps, type ReactNode, type SelectHTMLAttributes } from "react";
import { formatCents } from "../../shared/commission.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog.tsx";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";

/** A labelled control. The label wraps the control, so no ids are needed. `group` is for controls that bring their own labels (toggle groups). */
export function Field({ label, hint, children, group, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; group?: boolean; className?: string }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={`grid content-start gap-2 ${className}`}>
      <span className="text-sm leading-none font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Tag>
  );
}

function DollarSign() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
      $
    </span>
  );
}

/** A dollar amount that can't be negative: the decimal keypad on phones. */
export function MoneyInput({ className = "", ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <div className="relative">
      <DollarSign />
      <Input inputMode="decimal" autoComplete="off" {...props} className={`pl-7 tabular-nums ${className}`} />
    </div>
  );
}

/**
 * A dollar amount that can be negative (a deal's gross). The keypads phones show for amounts often have no minus key
 * (the iPhone's decimal pad, some Android number pads), so a +/− button flips the sign; a keyboard with a minus works too.
 */
export function SignedMoneyInput({
  value,
  onValueChange,
  className = "",
  ...props
}: Omit<ComponentProps<"input">, "type" | "value" | "onChange"> & { value: string; onValueChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const negative = value.includes("-");
  return (
    <div className="flex">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Negative amount"
        aria-pressed={negative}
        // Keep the field focused, so the phone keyboard stays up while the sign flips.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onValueChange(negative ? value.replace("-", "") : `-${value.trim()}`);
          input.current?.focus();
        }}
        className={`rounded-r-none border-r-0 border-input text-base ${negative ? "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive" : "text-muted-foreground"}`}
      >
        +/−
      </Button>
      <div className="relative min-w-0 flex-1">
        <DollarSign />
        <Input
          ref={input}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          {...props}
          className={`rounded-l-none pl-7 tabular-nums ${negative ? "text-destructive" : ""} ${className}`}
        />
      </div>
    </div>
  );
}

/** A whole-percent field: number keypad on phones, % shown after the value. */
export function PercentInput({ className = "", ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <div className="relative">
      <Input inputMode="numeric" autoComplete="off" {...props} className={`pr-8 tabular-nums ${className}`} />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
        %
      </span>
    </div>
  );
}

/** A native select dressed like the shadcn Input: phones and tablets open their own picker. */
export function NativeSelect({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-fine:h-9 pointer-fine:text-sm dark:bg-input/15 ${className}`}
    />
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {error instanceof Error ? error.message : String(error)}
    </p>
  );
}

export function Money({ cents, className = "", whole }: { cents: number; className?: string; whole?: boolean }) {
  return <span className={`tabular-nums ${cents < 0 ? "text-destructive" : ""} ${className}`}>{formatCents(cents, { whole })}</span>;
}

/** What the entry being logged pays, with the reasoning underneath. Shared by the deal and car-bought forms. */
export function PayPreview({ label, cents, detail }: { label: string; cents: number; detail: string }) {
  return (
    <div className="rounded-lg bg-positive-soft px-3.5 py-3 text-positive" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-display text-2xl leading-none font-semibold tabular-nums">{formatCents(cents)}</span>
      </div>
      <p className="mt-1 text-xs tabular-nums">{detail}</p>
    </div>
  );
}

/**
 * A trash button that asks first, naming exactly what goes and what it does to the check. `what` completes the button's accessible name.
 * `label` turns the icon into a text button with that label (the deal dialog's footer).
 */
export function ConfirmDelete({
  what,
  title,
  description,
  confirmLabel,
  onConfirm,
  disabled,
  label,
  className = "",
}: {
  what: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {label ? (
          <Button variant="ghost" className={`text-destructive hover:bg-destructive/10 hover:text-destructive ${className}`} disabled={disabled}>
            <Trash2 />
            {label}
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className={`text-muted-foreground hover:bg-destructive/10 hover:text-destructive ${className}`} disabled={disabled} aria-label={`Delete ${what}`}>
            <Trash2 />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** An empty list, phrased as what to do next. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
