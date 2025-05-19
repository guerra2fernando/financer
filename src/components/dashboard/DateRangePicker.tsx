/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/pages/dashboard/DateRangePicker.tsx
'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { addDays, format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';


interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  dateRange: DateRange | undefined;
  setDateRange: (dateRange: DateRange | undefined) => void;
}

export default function DateRangePickerComponent({
  className,
  dateRange,
  setDateRange,
}: DateRangePickerProps) {
  const today = new Date();

  const presets = [
    { label: 'Today', range: { from: today, to: today } },
    { label: 'Yesterday', range: { from: addDays(today, -1), to: addDays(today, -1) } },
    { label: 'This Week', range: { from: addDays(today, -today.getDay()), to: addDays(today, 6-today.getDay()) } },
    { label: 'Last Week', range: { from: addDays(today, -today.getDay()-7), to: addDays(today, -today.getDay()-1) } },
    { label: 'This Month', range: { from: startOfMonth(today), to: endOfMonth(today) } },
    { label: 'Last Month', range: { from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) } },
    { label: 'Last 30 Days', range: { from: subDays(today, 29), to: today } },
    { label: 'Last 90 Days', range: { from: subDays(today, 89), to: today } },
    { label: 'This Year', range: { from: startOfYear(today), to: endOfYear(today) } },
    { label: 'Year to Date', range: { from: startOfYear(today), to: today } },
    { label: 'Last Year', range: { from: startOfYear(subMonths(today,12)), to: endOfYear(subMonths(today,12)) } },
  ];

  const handlePresetChange = (value: string) => {
    const selectedPreset = presets.find(p => p.label === value);
    if (selectedPreset) {
      setDateRange(selectedPreset.range);
    }
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-[260px] justify-start text-left font-normal',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'LLL dd, y')} -{' '}
                  {format(dateRange.to, 'LLL dd, y')}
                </>
              ) : (
                format(dateRange.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex flex-col sm:flex-row">
            <div className="p-2 border-b sm:border-b-0 sm:border-r">
              <p className="text-sm font-medium px-2 py-1.5">Presets</p>
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => setDateRange(preset.range)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}