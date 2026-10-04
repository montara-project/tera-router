import { Icons } from '@/components/block/common/icons'
import { cn } from '@/lib/utils'

type Brand = {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  letter?: string
  tileClassName?: string
}

/**
 * api_kind is authoritative for the wire format, so custom providers with
 * arbitrary slugs still get a recognizable mark. Distinct brand slugs win
 * before the generic kind check: cloudflare and nvidia speak the OpenAI
 * dialect but must not wear the OpenAI logo.
 */
export function getProviderBrand(slug: string, apiKind?: string): Brand {
  if (slug === 'mimo-free') {
    return { letter: 'm', tileClassName: 'bg-orange-500 text-white' }
  }

  if (slug.includes('nvidia') || slug.includes('nemotron')) {
    return { icon: Icons.nvidia }
  }
  if (slug.includes('openrouter')) {
    return { icon: Icons.openrouter }
  }
  if (slug.includes('cloudflare')) {
    return { icon: Icons.cloudflare }
  }
  if (slug.includes('cline')) {
    return { icon: Icons.cline }
  }
  if (slug.includes('gemini')) {
    return { icon: Icons.gemini }
  }
  if (slug.includes('mistral')) {
    return { icon: Icons.mistral }
  }
  if (slug.includes('together')) {
    return { icon: Icons.together }
  }
  if (slug.includes('firework')) {
    return { icon: Icons.fireworks }
  }
  if (slug.includes('nebius')) {
    return { icon: Icons.nebius }
  }
  if (slug.includes('voyage')) {
    return { icon: Icons.voyage }
  }
  if (slug.includes('jina')) {
    return { icon: Icons.jina }
  }

  const kind = apiKind?.toLowerCase() ?? ''
  if (kind.includes('anthropic')) {
    return { icon: Icons.anthropic }
  }
  if (kind.includes('openai')) {
    return { icon: Icons.openai }
  }

  if (slug.includes('openai')) {
    return { icon: Icons.openai }
  }
  if (slug.includes('anthropic')) {
    return { icon: Icons.anthropic }
  }

  return { letter: slug.charAt(0).toUpperCase() }
}

type ProviderAvatarProps = {
  slug: string
  apiKind?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: { tile: 'h-8 w-8', icon: 'h-4 w-4', letter: 'text-xs font-bold' },
  md: { tile: 'h-10 w-10', icon: 'h-5 w-5', letter: 'text-sm font-bold' },
  lg: { tile: 'h-12 w-12 rounded-xl', icon: 'h-6 w-6', letter: 'text-lg font-bold' },
} as const

export function ProviderAvatar({ slug, apiKind, size = 'md', className }: ProviderAvatarProps) {
  const brand = getProviderBrand(slug, apiKind)
  const sizing = SIZES[size]

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-white text-zinc-900 ring-1 ring-border',
        sizing.tile,
        brand.tileClassName,
        className
      )}
    >
      {brand.icon ? (
        <brand.icon className={sizing.icon} />
      ) : (
        <span className={sizing.letter}>{brand.letter}</span>
      )}
    </span>
  )
}
