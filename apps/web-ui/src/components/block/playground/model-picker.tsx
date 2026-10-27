import { IconSelector } from '@tabler/icons-react'
import { useState } from 'react'

import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
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

/** Aliases first, then chains, then one group per provider slug. */
export function groupPlaygroundModels(models: Models.PlaygroundModel[]) {
  const groups = new Map<string, string[]>([
    ['alias', []],
    ['chain', []],
  ])
  for (const m of models) groups.set(m.owned_by, [...(groups.get(m.owned_by) ?? []), m.id])
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 0)
    .map(([owner, ids]) => ({
      label: owner === 'alias' ? 'Aliases' : owner === 'chain' ? 'Chains' : owner,
      ids,
    }))
}

export default function ModelPicker({
  models,
  value,
  onChange,
  disabled,
}: {
  models: Models.PlaygroundModel[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Choose model"
          disabled={disabled}
          className="w-72 max-w-full justify-between"
        >
          <span className="truncate font-mono text-xs">{value || 'Select a model'}</span>
          <IconSelector className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList>
            <ScrollArea viewportClassName="max-h-[340px] [&>div]:block!">
              <CommandEmpty>No models found.</CommandEmpty>
              {groupPlaygroundModels(models).map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.ids.map((id) => (
                    <CommandItem
                      key={id}
                      value={id}
                      onSelect={() => {
                        onChange(id)
                        setOpen(false)
                      }}
                    >
                      <span className="truncate font-mono text-xs">{id}</span>
                      {id === value && <CommandCheck />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
