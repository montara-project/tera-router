import { IconSelector } from '@tabler/icons-react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
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
import { cn } from '@/lib/utils'

/** The server caps a custom provider's model page at 100. */
const CUSTOM_MODELS_LIMIT = 100

export type ModelGroup = { slug: string; name: string; apiKind?: string; models: string[] }

/**
 * Active models of every usable provider, grouped by provider. Catalog
 * providers come from the playground list in one request; custom providers
 * are not in it, so their models load per provider.
 */
export function useChainModelGroups() {
  const providersQuery = useQuery(queries.providers.list())
  const playgroundQuery = useQuery(queries.playground.models())

  const usable = (providersQuery.data?.data?.connected ?? []).filter((p) => p.usable)
  // Catalog providers carry "prov-<slug>" ids; custom providers carry uuids.
  const custom = usable.filter((p) => !p.id.startsWith('prov-'))
  const customQueries = useQueries({
    queries: custom.map((p) =>
      queries.providers.customModels(p.id, { limit: CUSTOM_MODELS_LIMIT, state: 'active' })
    ),
  })

  const bySlug = new Map<string, string[]>()
  for (const m of playgroundQuery.data?.data ?? []) {
    if (m.owned_by === 'alias' || m.owned_by === 'chain') continue
    bySlug.set(m.owned_by, [...(bySlug.get(m.owned_by) ?? []), m.id.slice(m.owned_by.length + 1)])
  }
  custom.forEach((p, i) => {
    const models = (customQueries[i]?.data?.data?.models ?? [])
      .filter((m) => m.state === 'active')
      .map((m) => m.id)
    bySlug.set(p.slug, [...new Set([...(bySlug.get(p.slug) ?? []), ...models])])
  })

  const groups: ModelGroup[] = usable
    .filter((p) => bySlug.get(p.slug)?.length)
    .map((p) => ({
      slug: p.slug,
      name: p.name || p.slug,
      apiKind: p.api_kind,
      models: bySlug.get(p.slug) ?? [],
    }))

  return {
    groups,
    apiKinds: new Map(usable.map((p) => [p.slug, p.api_kind ?? ''])),
    loading: providersQuery.isLoading || playgroundQuery.isLoading,
  }
}

type Target = { provider: string; model: string }

interface ChainModelPickerProps {
  value: Target
  onChange: (value: Target) => void
  groups: ModelGroup[]
  apiKinds: Map<string, string>
  loading?: boolean
  /** accessible name, e.g. "Step 2 model" */
  label: string
  className?: string
}

/** One combobox for a provider + model pair, grouped by provider. */
export default function ChainModelPicker({
  value,
  onChange,
  groups,
  apiKinds,
  loading,
  label,
  className,
}: ChainModelPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value.provider && value.model ? `${value.provider}/${value.model}` : ''

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={selected ? `${label}: ${selected}` : label}
          className={cn(
            'flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-[13px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
            className
          )}
        >
          {selected ? (
            <>
              <ProviderAvatar
                slug={value.provider}
                apiKind={apiKinds.get(value.provider)}
                size="xs"
              />
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={selected}>
                {selected}
              </span>
            </>
          ) : (
            <span className="flex-1 text-muted-foreground">
              {loading ? 'Loading models…' : 'Choose a model…'}
            </span>
          )}
          <IconSelector className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Search models or providers…" />
          <CommandList className="max-h-[min(22rem,50dvh)] overscroll-contain">
            <CommandEmpty>
              {groups.length === 0
                ? 'No usable provider has active models yet.'
                : 'No model matches that search.'}
            </CommandEmpty>
            {groups.map((group) => (
              <CommandGroup
                key={group.slug}
                heading={
                  <span className="flex items-center gap-1.5">
                    <ProviderAvatar slug={group.slug} apiKind={group.apiKind} size="xs" />
                    {group.name}
                  </span>
                }
              >
                {group.models.map((model) => {
                  const id = `${group.slug}/${model}`
                  return (
                    <CommandItem
                      key={id}
                      value={id}
                      keywords={[group.name]}
                      onSelect={() => {
                        onChange({ provider: group.slug, model })
                        setOpen(false)
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-xs" title={id}>
                        {model}
                      </span>
                      {id === selected && <CommandCheck />}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
