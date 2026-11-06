import { IconSearch } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'

import SelectInput from '@/components/block/common/select-input'
import { Input, InputWrapper } from '@/components/ui/input'

import { PROVIDER_CAPABILITIES } from './connect-provider-dialog'

interface FilterProvidersProps {
  search: string
  onSearchChange: (value: string) => void
  capability: string
  onCapabilityChange: (value: string) => void
}

/** Panel toolbar of the connected providers table. */
export default function FilterProviders({
  search,
  onSearchChange,
  capability,
  onCapabilityChange,
}: FilterProvidersProps) {
  const searchRef = useRef<HTMLInputElement>(null)

  // "/" jumps to search, as the hint in the field says.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key !== '/' || target.closest('input, textarea, [contenteditable]')) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <InputWrapper className="w-full sm:w-64">
        <IconSearch aria-hidden />
        <Input
          ref={searchRef}
          type="search"
          aria-label="Search connected providers"
          aria-keyshortcuts="/"
          placeholder="Search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <kbd className="rounded-sm border border-border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
          /
        </kbd>
      </InputWrapper>
      <SelectInput
        aria-label="Capability"
        value={capability}
        onSelect={onCapabilityChange}
        className="w-full sm:w-44"
        options={[
          { value: 'all', label: 'All capabilities' },
          ...PROVIDER_CAPABILITIES.map((c) => ({ value: c.value as string, label: c.label })),
        ]}
      />
    </>
  )
}
