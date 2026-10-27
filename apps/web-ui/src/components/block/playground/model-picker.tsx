import { IconPackages, IconReplace, IconSelector, IconStack2 } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
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
import { queries } from '@/lib/api/queries'

// Same glyphs as the sidebar entries for Model Alias, Chains and Providers.
const KIND_ICON = { alias: IconReplace, chain: IconStack2, provider: IconPackages }

type ModelGroup = {
  owner: string
  kind: keyof typeof KIND_ICON
  ids: string[]
}

/** Aliases first, then chains, then one group per provider slug. */
export function groupPlaygroundModels(models: Models.PlaygroundModel[]): ModelGroup[] {
  const groups = new Map<string, string[]>([
    ['alias', []],
    ['chain', []],
  ])
  for (const m of models) groups.set(m.owned_by, [...(groups.get(m.owned_by) ?? []), m.id])
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 0)
    .map(([owner, ids]) => ({
      owner,
      kind: owner === 'alias' || owner === 'chain' ? owner : 'provider',
      ids,
    }))
}

export default function ModelPicker({
  models,
  value,
  onChange,
  loading,
  disabled,
}: {
  models: Models.PlaygroundModel[]
  value: string
  onChange: (id: string) => void
  loading?: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  // Provider display names; the slug stands in until (or unless) it loads.
  const providers = useQuery(queries.providers.list())
  const providerName = (slug: string) =>
    providers.data?.data?.connected.find((p) => p.slug === slug)?.name || slug

  const groups = groupPlaygroundModels(models)
  const groupLabel = (group: ModelGroup) =>
    group.kind === 'alias'
      ? 'Aliases'
      : group.kind === 'chain'
        ? 'Chains'
        : providerName(group.owner)
  const SelectedIcon =
    KIND_ICON[groups.find((g) => g.ids.includes(value))?.kind ?? 'provider'] ?? IconPackages

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={value ? `Model: ${value}. Change model` : 'Choose a model'}
          disabled={disabled || loading}
          className="max-w-full min-w-0 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        >
          <SelectedIcon className="size-4 shrink-0" />
          <span className="truncate font-mono text-xs text-foreground">
            {loading ? 'Loading models…' : value || 'Choose a model'}
          </span>
          <IconSelector className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Search models, aliases, chains…" />
          <CommandList className="scrollbar-seamless max-h-[min(22rem,50dvh)]">
            <CommandEmpty>No model matches that search.</CommandEmpty>
            {groups.map((group) => {
              const Icon = KIND_ICON[group.kind]
              const label = groupLabel(group)
              return (
                <CommandGroup
                  key={group.owner}
                  heading={
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-3.5" />
                      {label}
                      <span className="ms-auto tabular-nums opacity-70">{group.ids.length}</span>
                    </span>
                  }
                >
                  {group.ids.map((id) => {
                    // Inside its provider's group the "slug/" prefix is noise;
                    // the full id stays the value, so search still matches it.
                    const short = group.kind === 'provider' ? id.slice(group.owner.length + 1) : id
                    return (
                      <CommandItem
                        key={id}
                        value={id}
                        keywords={[label]}
                        title={id}
                        onSelect={() => {
                          onChange(id)
                          setOpen(false)
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">{short}</span>
                        {id === value && <CommandCheck />}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
