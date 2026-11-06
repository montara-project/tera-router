'use client'

import { IconPlus, IconX } from '@tabler/icons-react'
import React, { useState } from 'react'

import type { Option } from '@/types/select'

import { Badge, BadgeButton } from '@/components/ui/badge'
import { Button, ButtonArrow } from '@/components/ui/button'
import {
  Command,
  CommandCheck,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ComboboxInputProps<TData> {
  options: Option<TData>[]
  label: string
  defaultValues: string[]
  onSelect: (value: string[]) => void
  onBlur?: () => void
  /** live selection from the owning field; omit for uncontrolled use */
  selection?: string[]
  /** false replaces the selection and closes the popover on pick */
  multiple?: boolean
  /** Trigger text while nothing is selected; falls back to the label */
  placeholder?: string
  disabled?: boolean
  /**
   * Offers the typed text as a new value, for free-form fields. In single
   * mode, picking the selected value again also clears it.
   */
  creatable?: boolean
  /** id for the trigger, so a field label can point at it */
  id?: string
}

export default function ComboboxInput<TData>({
  options,
  defaultValues,
  label,
  onSelect,
  onBlur,
  selection,
  multiple = true,
  placeholder,
  disabled = false,
  creatable = false,
  id,
}: ComboboxInputProps<TData>) {
  const [open, setOpen] = useState(false)
  const [fallbackSelection, setFallbackSelection] = React.useState<string[]>(defaultValues)
  const selectedValues = selection ?? fallbackSelection
  const [search, setSearch] = useState('')
  const typed = search.trim()
  const canCreate =
    creatable &&
    typed !== '' &&
    !options.some((o) => o.value === typed) &&
    !selectedValues.includes(typed)

  const applySelection = (next: string[]) => {
    if (selection === undefined) setFallbackSelection(next)
    onSelect(next)
  }

  const toggleSelection = (value: string) => {
    if (!multiple) {
      applySelection(creatable && selectedValues[0] === value ? [] : [value])
      setSearch('')
      setOpen(false)
      return
    }
    applySelection(
      selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value]
    )
    // A created value leaves the list open for the next pick, with a clean search.
    if (creatable) setSearch('')
  }

  const removeSelection = (value: string) => {
    applySelection(selectedValues.filter((v) => v !== value))
  }

  const selectedLabel = (value: string) => options.find((c) => c.value === value)?.label ?? value

  return (
    // modal: the content is portaled outside any open Dialog, whose scroll lock
    // would otherwise swallow wheel/touch scrolling in the option list.
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Every open starts with an empty search, as when the input was uncontrolled.
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          autoHeight={true}
          mode="input"
          placeholder={selectedValues.length === 0}
          disabled={disabled}
          className="relative w-full p-1"
        >
          <div className="flex flex-wrap items-center gap-1 pe-2.5">
            {selectedValues.length > 0 ? (
              multiple ? (
                selectedValues.map((val) => {
                  const item = options.find((c) => c.value === val)
                  // Created values (patterns) have no option of their own.
                  return item || creatable ? (
                    <Badge
                      key={val}
                      variant="outline"
                      className="text-primary bg-ivory font-medium"
                    >
                      {item?.label ?? val}
                      <BadgeButton
                        className="text-primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeSelection(val)
                        }}
                      >
                        <IconX />
                      </BadgeButton>
                    </Badge>
                  ) : null
                })
              ) : (
                <span className="px-2.5">{selectedLabel(selectedValues[0])}</span>
              )
            ) : (
              <span className="px-2.5">{placeholder || label}</span>
            )}
          </div>
          <ButtonArrow className="absolute inset-e-3 top-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popper-anchor-width) p-0">
        <Command>
          <CommandInput
            placeholder={
              creatable
                ? `Search or create ${label.toLowerCase()}...`
                : `Search ${label.toLowerCase()}...`
            }
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <ScrollArea viewportClassName="max-h-[300px] [&>div]:block!">
              {canCreate ? null : <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>}
              {canCreate ? (
                <CommandGroup>
                  <CommandItem value={`create:${typed}`} onSelect={() => toggleSelection(typed)}>
                    <IconPlus className="text-muted-foreground" aria-hidden />
                    <span className="truncate">Create “{typed}”</span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
              <CommandGroup>
                {options.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    // Search matches the label too, so an id-valued option (an API key) is found by name.
                    keywords={[item.label]}
                    onSelect={() => toggleSelection(item.value)}
                    onBlur={onBlur}
                  >
                    <span className="truncate">{item.label}</span>
                    {selectedValues.includes(item.value) && <CommandCheck />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
