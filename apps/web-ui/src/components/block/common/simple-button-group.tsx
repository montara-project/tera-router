import { ButtonGroup, ButtonGroupItem } from '@/components/ui/button-group'

export interface SimpleButtonGroupItem {
  label: string
  value: string
}

interface SimpleButtonGroupProps {
  items: SimpleButtonGroupItem[]
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export default function SimpleButtonGroup({
  items,
  defaultValue,
  onValueChange,
}: SimpleButtonGroupProps) {
  return (
    <div className="flex flex-col items-center gap-8">
      <ButtonGroup
        type="single"
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        className="bg-sidebar"
      >
        {items.map((item) => (
          <ButtonGroupItem key={item.value} value={item.value}>
            {item.label}
          </ButtonGroupItem>
        ))}
      </ButtonGroup>
    </div>
  )
}
