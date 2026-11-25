import * as React from "react";
import { CalendarDays, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const pad = (n) => String(n).padStart(2, "0");

/**
 * A stored timestamp (ISO, UTC) as a local "YYYY-MM-DDTHH:mm" string, the
 * format this picker and <input type="datetime-local"> work in. Slicing the
 * ISO string instead would show UTC as if it were local time, so the value
 * would shift by the timezone offset on every save.
 */
export function toLocalInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A local "YYYY-MM-DDTHH:mm" string as an ISO timestamp for saving (or null). */
export function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const parseLocal = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Date + time picker: a themed calendar in a popover with a time field.
 *   value / onChange: local "YYYY-MM-DDTHH:mm" string, "" when empty
 *   (use toLocalInput / fromLocalInput to convert to and from the database).
 *   disablePast: days before today can't be picked.
 *   defaultTime: the time used when a day is picked first (default 23:59).
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disablePast = false,
  defaultTime = "23:59",
  clearable = true,
  className,
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parseLocal(value);
  const time = selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : defaultTime;

  const emit = (day, hhmm) => {
    const [h, m] = (hhmm || defaultTime).split(":").map(Number);
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0);
    onChange(toLocalInput(d));
  };

  const label = selected
    ? selected.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : placeholder;

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start gap-2 font-normal",
              clearable && selected && "pr-9",
              !selected && "text-muted-foreground"
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected || undefined}
            defaultMonth={selected || undefined}
            onSelect={(day) => day && emit(day, time)}
            disabled={disablePast ? { before: startOfDay(new Date()) } : undefined}
            autoFocus
          />
          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              type="time"
              aria-label="Time"
              value={time}
              onChange={(e) => emit(selected || new Date(), e.target.value)}
              className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="button" size="sm" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </PopoverContent>
      </Popover>
      {clearable && selected && (
        <button
          type="button"
          aria-label="Clear date"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
