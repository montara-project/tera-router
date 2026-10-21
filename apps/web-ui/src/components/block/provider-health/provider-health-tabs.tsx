import SegmentedControl from '@/components/block/common/segmented-control'

export const HEALTH_TABS = [
  { value: 'providers', label: 'Providers' },
  { value: 'models', label: 'Models' },
  { value: 'chains', label: 'Chains' },
  { value: 'probes', label: 'Probes' },
] as const

export type HealthTab = (typeof HEALTH_TABS)[number]['value']

interface ProviderHealthTabsProps {
  value: HealthTab
  onChange: (value: HealthTab) => void
}

export default function ProviderHealthTabs({ value, onChange }: ProviderHealthTabsProps) {
  return (
    <SegmentedControl
      aria-label="Health view"
      size="md"
      options={HEALTH_TABS}
      value={value}
      onChange={onChange}
    />
  )
}
