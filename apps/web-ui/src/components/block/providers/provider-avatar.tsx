import { Icons } from '@/components/block/common/icons'
import { cn } from '@/lib/utils'

type Brand = {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  letter?: string
  tileClassName?: string
}

/**
 * api_kind is authoritative for the upstream wire format, so it wins over
 * slug heuristics — custom providers can have arbitrary slugs.
 */
export function getProviderBrand(slug: string, apiKind?: string): Brand {
  if (slug === 'mimo-free') {
    return { letter: 'm', tileClassName: 'bg-orange-500 text-white' }
  }

  const kind = apiKind?.toLowerCase() ?? ''
  if (kind.includes('anthropic')) {
    return { icon: Icons.claude }
  }
  if (kind.includes('openai')) {
    return { icon: Icons.chatgpt }
  }

  if (slug.includes('openai')) {
    return { icon: Icons.chatgpt }
  }
  if (slug.includes('anthropic') || slug === 'claude') {
    return { icon: Icons.claude }
  }

  return { letter: slug.charAt(0).toUpperCase() }
}

type ProviderAvatarProps = {
  slug: string
  apiKind?: string
  size?: 'sm' | 'md'
  className?: string
}

export function ProviderAvatar({ slug, apiKind, size = 'md', className }: ProviderAvatarProps) {
  const brand = getProviderBrand(slug, apiKind)

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-white text-zinc-900 ring-1 ring-border',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        brand.tileClassName,
        className
      )}
    >
      {brand.icon ? (
        <brand.icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      ) : (
        <span className={size === 'sm' ? 'text-xs font-bold' : 'text-sm font-bold'}>
          {brand.letter}
        </span>
      )}
    </span>
  )
}
