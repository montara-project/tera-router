import { useQueries, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
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
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

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
    queries: custom.map((p) => queries.providers.allActiveModels('custom', p.id)),
  })

  const bySlug = new Map<string, string[]>()
  for (const m of playgroundQuery.data?.data ?? []) {
    if (m.owned_by === 'alias' || m.owned_by === 'chain') continue
    bySlug.set(m.owned_by, [...(bySlug.get(m.owned_by) ?? []), m.id.slice(m.owned_by.length + 1)])
  }
  custom.forEach((p, i) => {
    const models = (customQueries[i]?.data?.data?.models ?? []).map((m) => m.id)
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
  /** id for the trigger, so a field label can point at it */
  id?: string
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
  id,
}: ChainModelPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value.provider && value.model ? `${value.provider}/${value.model}` : ''

  return (
    // modal: the content is portaled outside any open Dialog, whose scroll lock
    // would otherwise swallow wheel/touch scrolling in the option list.
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={selected ? `${label}: ${selected}` : label}
          autoHeight={true}
          mode="input"
          placeholder={!selected}
          className={cn('relative w-full min-w-0 p-1', className)}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 ps-2.5 pe-7">
            {selected ? (
              <>
                <ProviderAvatar
                  slug={value.provider}
                  apiKind={apiKinds.get(value.provider)}
                  size="xs"
                />
                <span className="min-w-0 flex-1 truncate text-start" title={selected}>
                  {selected}
                </span>
              </>
            ) : (
              <span className="truncate">
                {loading ? 'Loading models...' : 'Choose a model...'}
              </span>
            )}
          </div>
          <ButtonArrow className="absolute inset-e-3 top-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popper-anchor-width) min-w-72 p-0">
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList>
            <ScrollArea viewportClassName="max-h-[300px] [&>div]:block!">
              <CommandEmpty>
                {groups.length === 0
                  ? 'No usable provider has active models yet.'
                  : 'No models found.'}
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
                        <span className="truncate" title={id}>
                          {model}
                        </span>
                        {id === selected && <CommandCheck />}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
