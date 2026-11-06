import {
  IconMicrophone,
  IconPhoto,
  IconSearch,
  IconSparkles,
  IconWaveSine,
  IconWorld,
} from '@tabler/icons-react'

import type { MediaCategory } from '@/lib/api/models/media'

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
    label: 'Web search',
    icon: IconSearch,
    description: 'Web search providers for grounding answers',
  },
  {
    value: 'fetch',
    label: 'Web fetch',
    icon: IconWorld,
    description: 'Web fetch providers for page retrieval',
  },
]

interface MediaTabsProps {
  value: MediaCategory
  onChange: (value: MediaCategory) => void
}

/** Category chips: one capability at a time, as in the quota filters. */
export default function MediaTabs({ value, onChange }: MediaTabsProps) {
  return (
    <div role="group" aria-label="Capability" className="flex flex-wrap items-center gap-1.5">
      {MEDIA_CATEGORIES.map((category) => {
        const active = category.value === value
        return (
          <button
            key={category.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(category.value)}
            className={cn(
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors',
              active
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            <category.icon className="size-4" aria-hidden />
            {category.label}
          </button>
        )
      })}
    </div>
  )
}
