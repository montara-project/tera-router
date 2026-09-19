import {
  IconDownload,
  IconHexagons,
  IconMessageCircle,
  IconMicrophone,
  IconPhoto,
  IconSpeakerphone,
  IconTable,
  IconWorld,
} from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CAPABILITIES = [
  { value: 'all', label: 'All', icon: IconHexagons },
  { value: 'chat', label: 'Chat', icon: IconMessageCircle },
  { value: 'embeddings', label: 'Embeddings', icon: IconTable },
  { value: 'image', label: 'Image', icon: IconPhoto },
  { value: 'stt', label: 'STT', icon: IconMicrophone },
  { value: 'tts', label: 'TTS', icon: IconSpeakerphone },
  { value: 'search', label: 'Search', icon: IconWorld },
  { value: 'fetch', label: 'Fetch', icon: IconDownload },
]

interface CapabilityChipsProps {
  value: string
  onChange: (value: string) => void
}

export default function CapabilityChips({ value, onChange }: CapabilityChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CAPABILITIES.map((capability) => {
        const active = capability.value === value

        return (
          <Button
            key={capability.value}
            variant="outline"
            size="sm"
            className={cn(
              'rounded-lg',
              active &&
                'border-emerald-500/40 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300'
            )}
            onClick={() => onChange(capability.value)}
          >
            <capability.icon className="h-3.5 w-3.5" />
            <span>{capability.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
