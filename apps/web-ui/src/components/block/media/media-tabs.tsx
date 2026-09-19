import {
  IconMicrophone,
  IconPhoto,
  IconSearch,
  IconSparkles,
  IconWaveSine,
  IconWorld,
} from '@tabler/icons-react'

import type { MediaCategory } from '@/lib/api/models/media'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const MEDIA_CATEGORIES: {
  value: MediaCategory
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  description: string
}[] = [
  {
    value: 'embeddings',
    label: 'Embeddings',
    icon: IconSparkles,
    description: 'Text embedding models for search and RAG',
  },
  {
    value: 'image',
    label: 'Image',
    icon: IconPhoto,
    description: 'Image generation models for creative workflows',
  },
  {
    value: 'tts',
    label: 'Text-to-Speech',
    icon: IconWaveSine,
    description: 'Text-to-speech voices for narration and agents',
  },
  {
    value: 'stt',
    label: 'Speech-to-Text',
    icon: IconMicrophone,
    description: 'Speech-to-text models for transcription',
  },
  {
    value: 'search',
    label: 'Web Search',
    icon: IconSearch,
    description: 'Web search providers for grounding answers',
  },
  {
    value: 'fetch',
    label: 'Web Fetch',
    icon: IconWorld,
    description: 'Web fetch providers for page retrieval',
  },
]

interface MediaTabsProps {
  value: MediaCategory
  onChange: (value: MediaCategory) => void
}

export default function MediaTabs({ value, onChange }: MediaTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {MEDIA_CATEGORIES.map((category) => {
        const active = category.value === value

        return (
          <Button
            key={category.value}
            variant={active ? 'primary' : 'outline'}
            size="sm"
            className={cn(
              'rounded-lg',
              active &&
                'bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-600 dark:hover:bg-emerald-600/90'
            )}
            onClick={() => onChange(category.value)}
          >
            <category.icon className="h-3.5 w-3.5" />
            <span>{category.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
