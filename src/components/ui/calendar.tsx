"use client"

import * as React from "react"
import { DayPicker, DayPickerProps } from "react-day-picker" // Import DayPickerProps for better typing

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// Explicitly type the CalendarProps by extending DayPickerProps
export type CalendarProps = DayPickerProps

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2", // Custom: gap-2 instead of space-y-4
        month: "flex flex-col gap-4", // Custom: gap-4 instead of space-y-4
        caption: "flex justify-center pt-1 relative items-center w-full", // Adjusted w-full from original shadcn
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1", // Custom: gap-1
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1 flex items-center justify-center [&::before]:content-[url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"currentColor\" class=\"w-4 h-4\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M15.41 7.41L10 13.41L15.41 19.41M8 6l-6 6l6 6\"/></svg')] bg-none",
        nav_button_next: "absolute right-1 flex items-center justify-center [&::before]:content-[url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"currentColor\" class=\"w-4 h-4\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M8.59 7.41L14 13.41L8.59 19.41M16 6l6 6l-6 6\"/></svg')] bg-none",
        table: "w-full border-collapse space-y-1", // Shadcn uses space-y-1, original had space-x-1 which is for horizontal
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_start: "day-range-start", // Base class, specific styling in day_selected
        day_range_end: "day-range-end",     // Base class, specific styling in day_selected
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30", // Adjusted from shadcn
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames, // Allow overriding with passed classNames
      }}
      {...props} // Spread the rest of the DayPicker props
    />
  )
}
Calendar.displayName = "Calendar" // Good practice for React components

export { Calendar }
