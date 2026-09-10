'use client'

import { IconArrowDown } from '@tabler/icons-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Option {
  label: string
  value: string
  icon?: typeof IconArrowDown
}

interface SelectInputProps {
  placeholder: string
  options: Option[]
  onSelect: (value: string) => void
  defaultValue?: string
  className?: string
}

export default function SelectInput({
  placeholder,
  options,
  onSelect,
  defaultValue,
  className,
}: SelectInputProps) {
  return (
    <Select onValueChange={onSelect} defaultValue={defaultValue} indicatorPosition="right">
      <SelectTrigger className={className ?? 'w-50'}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.icon && <option.icon className="mr-2 h-4 w-4" />}
            <span>{option.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
