import { IconSearch } from '@tabler/icons-react'

import SelectInput from '@/components/block/common/select-input'
import { Input, InputWrapper } from '@/components/ui/input'

export type PricingScope = 'all' | 'model' | 'provider'

interface FilterPricingProps {
  search: string
  onSearchChange: (value: string) => void
  scope: PricingScope
  onScopeChange: (value: PricingScope) => void
}

/** Panel toolbar, laid out like the /providers table's. */
export default function FilterPricing({
  search,
  onSearchChange,
  scope,
  onScopeChange,
}: FilterPricingProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputWrapper className="w-full sm:w-64">
        <IconSearch aria-hidden />
        <Input
          type="search"
          aria-label="Search overrides"
          placeholder="Search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </InputWrapper>
      <SelectInput
        aria-label="Scope"
        value={scope}
        onSelect={(value) => onScopeChange(value as PricingScope)}
        className="w-full sm:w-40"
        options={[
          { value: 'all', label: 'All scopes' },
          { value: 'model', label: 'Per model' },
          { value: 'provider', label: 'Provider-wide' },
        ]}
      />
    </div>
  )
}
