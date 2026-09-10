import { IconSearch } from '@tabler/icons-react'

import { Input, InputWrapper } from '@/components/ui/input'
import { CHAIN_STRATEGY_OPTIONS } from '@/lib/constants/chain'
import { PROVIDER_HEALTH_OPTIONS } from '@/lib/constants/provider'

import SelectInput from '../../common/select-input'

export default function FilterChain() {
  return (
    <div className="flex items-center gap-2">
      <InputWrapper variant="lg" className="rounded-lg">
        <IconSearch />
        <Input placeholder="Search chains..." />
      </InputWrapper>

      <SelectInput
        className="w-50 h-10"
        placeholder="Select strategy"
        options={[{ value: 'all', label: 'All strategy' }, ...CHAIN_STRATEGY_OPTIONS]}
        defaultValue="all"
        onSelect={(value) => {
          console.log(value)
        }}
      />

      <SelectInput
        className="w-50 h-10"
        placeholder="Select health"
        options={[{ value: 'all', label: 'All health' }, ...PROVIDER_HEALTH_OPTIONS]}
        defaultValue="all"
        onSelect={(value) => {
          console.log(value)
        }}
      />
    </div>
  )
}
