import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { monthOf, today } from "../../shared/dates.ts";
import { formatDate, formatMonth } from "./common.tsx";
import { Button } from "./ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

/** A calendar button that opens a year of months, to jump straight to any month instead of stepping with the arrows. */
export function MonthPicker({ month, onSelect, className }: { month: string; onSelect: (month: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(month.slice(0, 4)));
  const current = monthOf(today());

  function onOpenChange(next: boolean) {
    // Every time it opens, start on the year being viewed.
    if (next) setYear(Number(month.slice(0, 4)));
    setOpen(next);
  }

  function choose(value: string) {
    setOpen(false);
    if (value !== month) onSelect(value);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={`text-muted-foreground ${className ?? ""}`} aria-label="Choose a month">
          <CalendarDays className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // Keeps the panel off the screen edge on phones, matching the page's 16px gutter.
        collisionPadding={16}
        className="w-72 p-3"
        // Keyboard focus starts on the month being viewed rather than the year arrows.
        onOpenAutoFocus={(e) => {
          const viewed = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[aria-current='date']");
          if (viewed) {
            e.preventDefault();
            viewed.focus();
          }
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" onClick={() => setYear(year - 1)} aria-label={`Previous year, ${year - 1}`}>
            <ChevronLeft />
          </Button>
          <span className="font-display text-xl font-semibold tabular-nums" aria-live="polite">
            {year}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setYear(year + 1)} aria-label={`Next year, ${year + 1}`}>
            <ChevronRight />
          </Button>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {MONTHS.map((mm) => {
            const value = `${year}-${mm}`;
            const viewed = value === month;
            const thisMonth = value === current;
            return (
              <Button
                key={value}
                variant={viewed ? "default" : "ghost"}
                // The month being viewed is filled; the real current month gets an outline.
                className={thisMonth && !viewed ? "text-positive ring-1 ring-positive ring-inset" : ""}
                aria-current={viewed ? "date" : undefined}
                aria-label={`${formatMonth(value)}${thisMonth ? " (this month)" : ""}`}
                onClick={() => choose(value)}
              >
                {formatDate(`${value}-01`, { month: "short" })}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
