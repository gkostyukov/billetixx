"use client"

import * as React from "react"
import ReactDatePicker from "react-datepicker"
import { cn } from "@/lib/utils"
import { CalendarIcon } from "@radix-ui/react-icons"

interface DatePickerProps {
  id?: string
  value?: string
  onChange: (date: string) => void
  className?: string
  required?: boolean
  placeholder?: string
}

export function DatePicker({
  id,
  value,
  onChange,
  className,
  required,
  placeholder = "Select date"
}: DatePickerProps) {
  const selectedDate = value ? new Date(value) : null

  const handleChange = (date: Date | null) => {
    if (date) {
      // Format date as YYYY-MM-DD
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      onChange(`${year}-${month}-${day}`)
    } else {
      onChange('')
    }
  }

  return (
    <div className="relative">
      <ReactDatePicker
        id={id}
        selected={selectedDate}
        onChange={handleChange}
        dateFormat="MMM dd, yyyy"
        placeholderText={placeholder}
        required={required}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        calendarClassName="!bg-white dark:!bg-gray-900 !border-2 !border-border !shadow-xl"
        dayClassName={(date) =>
          cn(
            "hover:!bg-blue-100 dark:hover:!bg-blue-900 !text-foreground rounded-md",
            date.getDate() === selectedDate?.getDate() &&
            date.getMonth() === selectedDate?.getMonth() &&
            date.getFullYear() === selectedDate?.getFullYear()
              ? "!bg-primary !text-primary-foreground"
              : ""
          )
        }
        wrapperClassName="w-full"
        popperClassName="!z-[100]"
        popperPlacement="bottom-start"
        showPopperArrow={false}
        portalId="root"
      />
      <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
    </div>
  )
}
