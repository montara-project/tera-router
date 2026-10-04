import { IconSearch } from '@tabler/icons-react'

import { Input, InputWrapper } from '@/components/ui/input'

import SelectInput from '../../common/select-input'

const PRICING_SCOPE_OPTIONS = [
  { value: 'model', label: 'Per model' },
  { value: 'provider', label: 'Provider-wide' },
]

interface FilterPricingProps {
  search: string
  onSearchChange: (value: string) => void
  onScopeChange: (value: string) => void
}

export default function FilterPricing({
  search,
  onSearchChange,
  onScopeChange,
}: FilterPricingProps) {
  return (
    <div className="flex items-center gap-2">
      <InputWrapper variant="lg" className="rounded-lg">
        <IconSearch />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search overrides..."
        />
      </InputWrapper>

      <SelectInput
        className="w-50 h-10"
        placeholder="Select scope"
        options={[{ value: 'all', label: 'All scope' }, ...PRICING_SCOPE_OPTIONS]}
        defaultValue="all"
        onSelect={onScopeChange}
      />
    </div>
  )
}
