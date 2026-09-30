import { IconSearch } from '@tabler/icons-react'

import { Input, InputWrapper } from '@/components/ui/input'
import { CHAIN_STRATEGY_OPTIONS } from '@/lib/constants/chain'

import SelectInput from '../../common/select-input'

const CHAIN_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

interface FilterChainProps {
  search: string
  onSearchChange: (value: string) => void
  onStrategyChange: (value: string) => void
  onStatusChange: (value: string) => void
}

export default function FilterChain({
  search,
  onSearchChange,
  onStrategyChange,
  onStatusChange,
}: FilterChainProps) {
  return (
    <div className="flex items-center gap-2">
      <InputWrapper variant="lg" className="rounded-lg">
        <IconSearch />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search chains..."
        />
      </InputWrapper>

      <SelectInput
        className="w-50 h-10"
        placeholder="Select strategy"
        options={[{ value: 'all', label: 'All strategy' }, ...CHAIN_STRATEGY_OPTIONS]}
        defaultValue="all"
        onSelect={onStrategyChange}
      />

      <SelectInput
        className="w-50 h-10"
        placeholder="Select status"
        options={[{ value: 'all', label: 'All status' }, ...CHAIN_STATUS_OPTIONS]}
        defaultValue="all"
        onSelect={onStatusChange}
      />
    </div>
  )
}
