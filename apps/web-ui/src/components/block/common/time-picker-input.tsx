'use client'

import { IconClock, IconX } from '@tabler/icons-react'
import React from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'

// 00:00, 00:30 … 23:30
const TIME_SLOTS = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
)

interface TimePickerInputProps {
  time: string | undefined
  onTimeChange: (time: string | undefined) => void
  placeholder?: string
}

export default function TimePickerInput({ time, onTimeChange, placeholder }: TimePickerInputProps) {
  const [open, setOpen] = React.useState(false)

  const handleReset = (e: React.MouseEvent<HTMLElement>) => {
    onTimeChange(undefined)
    e.preventDefault()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-62.5">
          <Button
            type="button"
            variant="outline"
            mode="input"
            placeholder={!time}
            className="w-full"
          >
            <IconClock />
            {time || <span>{placeholder || 'Pick a time'}</span>}
          </Button>
          {time && (
            <Button
              type="button"
              variant="dim"
              size="sm"
              className="absolute -end-0 top-1/2 -translate-y-1/2"
              onClick={handleReset}
            >
              <IconX />
            </Button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-0" align="start">
        <ScrollArea className="h-64">
          <div className="grid gap-1.5 p-3">
            {TIME_SLOTS.map((slot) => (
              <Button
                key={slot}
                type="button"
                variant={time === slot ? 'primary' : 'outline'}
                // Open on the picked slot instead of 00:00.
                ref={time === slot ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                size="sm"
                className="w-full"
                onClick={() => {
                  onTimeChange(slot)
                  setOpen(false)
                }}
              >
                {slot}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
