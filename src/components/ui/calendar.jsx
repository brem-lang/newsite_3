import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Themed month calendar on react-day-picker v9 (its class names and
 * components differ from v8, which this file was first written for).
 */
function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "space-y-3",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-sm font-semibold",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(buttonVariants({ variant: "outline" }), "h-8 w-8 p-0 bg-transparent opacity-70 hover:opacity-100 disabled:opacity-30"),
        button_next: cn(buttonVariants({ variant: "outline" }), "h-8 w-8 p-0 bg-transparent opacity-70 hover:opacity-100 disabled:opacity-30"),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-[0.75rem] font-normal text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-sm",
        day_button: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal"),
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground rounded-md",
        today: "[&>button]:font-bold [&>button]:text-accent",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-40 [&>button]:cursor-not-allowed",
        range_start: "rounded-l-md bg-accent/20",
        range_middle: "bg-accent/20",
        range_end: "rounded-r-md bg-accent/20",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: cls }) =>
          orientation === "left" ? <ChevronLeft className={cn("h-4 w-4", cls)} /> : <ChevronRight className={cn("h-4 w-4", cls)} />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
